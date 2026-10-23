import {
  and, asc, count, db, desc, enrollments, eq, eventInvitations, events, ilike, or, sql, ticketTypeQuestions, tickets,
  ticketTypes, users, type TicketAnswer,
} from "@app/db";
import { enqueueMail } from "@app/mail";
import {
  accountLink, activeEnrollment, EnrollmentNotFound, formatMailTime, invitationTaken, markConfirmed, seatsTaken,
  sendTicketMails, SoldOut, ticketCode,
} from "@app/tickets";
import { eventAccess, findInvitation, manages, type Viewer } from "../../libs/access";
import { effectiveStatusSql, loadEnrollments } from "../../libs/enrollments";
import {
  EnrollmentNotOpen, EnrollmentNotPending, InvalidAnswers, InvitationUsed, LimitReached, NotInvited, TicketTypeNotFound,
} from "../../libs/errors";
import type * as EnrollmentModel from "./model";

/** How long a first_come or invite payment holds its seats: the 30-minute Checkout session plus slack for the webhook. */
export const PAYMENT_HOLD_MS = 35 * 60_000;
/** How long an approved paid enrollment waits for its payment. */
export const APPROVED_PAYMENT_WINDOW_MS = 72 * 3_600_000;

type QuestionRow = typeof ticketTypeQuestions.$inferSelect;

const SHORT_TEXT_MAX = 200;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

/**
 * The tickets the attendees stand for, with their answers checked against the ticket type's
 * questions and copied with their labels; InvalidAnswers if one is missing, too long, not one of
 * a choice's options, or for a question this type doesn't ask.
 */
function toTickets(attendees: EnrollmentModel.AttendeeInput[], questions: QuestionRow[]) {
  const known = new Set(questions.map((question) => question.id));
  const rows = [];
  for (const attendee of attendees) {
    if (attendee.answers.some((answer) => !known.has(answer.questionId))) return new InvalidAnswers();
    const given = new Map(attendee.answers.map((answer) => [answer.questionId, answer.value.trim()]));
    const answers: TicketAnswer[] = [];
    for (const question of questions) {
      const value = given.get(question.id) ?? "";
      if (!value) {
        if (question.required) return new InvalidAnswers();
        continue;
      }
      if (question.type === "short_text" && value.length > SHORT_TEXT_MAX) return new InvalidAnswers();
      if (question.type === "choice" && !question.options?.includes(value)) return new InvalidAnswers();
      answers.push({ questionId: question.id, label: question.label, value });
    }
    rows.push({
      firstName: attendee.firstName.trim(),
      lastName: attendee.lastName.trim(),
      email: attendee.email.trim().toLowerCase(),
      answers,
    });
  }
  return rows;
}

/**
 * Enrolls `buyer` in a ticket type, one ticket per attendee. Everything that limits it (the event
 * being open, the buyer's limit, the seats, the invitation) is checked under a lock on the ticket
 * type row, the same lock its quota edits and confirmations take, so concurrent enrollments can't
 * oversell. Free first_come and invite tickets are confirmed and mailed right away; paid ones wait
 * for payment (apps/payment), approval ones for the organizer.
 */
export async function enroll(buyer: Viewer, input: EnrollmentModel.Post["Body"]) {
  const [found] = await db
    .select({ event: events })
    .from(ticketTypes)
    .innerJoin(events, eq(events.id, ticketTypes.eventId))
    .where(eq(ticketTypes.id, input.ticketTypeId));
  if (!found) return new TicketTypeNotFound();
  const { event } = found;
  const invitation = await findInvitation(event.id, buyer.email);
  const access = eventAccess(event, buyer, !!invitation);
  if (access instanceof Error) return access;
  if (access !== "open") return new EnrollmentNotOpen();

  const questions = await db
    .select()
    .from(ticketTypeQuestions)
    .where(eq(ticketTypeQuestions.ticketTypeId, input.ticketTypeId))
    .orderBy(asc(ticketTypeQuestions.position));
  const attendees = toTickets(input.attendees, questions);
  if (attendees instanceof Error) return attendees;
  const quantity = attendees.length;

  const created = await db.transaction(async (tx) => {
    const [ticketType] = await tx.select().from(ticketTypes).where(eq(ticketTypes.id, input.ticketTypeId)).for("update");
    if (!ticketType) return new TicketTypeNotFound();

    const [mine] = await tx
      .select({ total: sql<number>`coalesce(sum(${enrollments.quantity}), 0)`.mapWith(Number) })
      .from(enrollments)
      .where(and(eq(enrollments.ticketTypeId, ticketType.id), eq(enrollments.buyerId, buyer.id), activeEnrollment()));
    if ((mine?.total ?? 0) + quantity > ticketType.maxPerUser) return new LimitReached();
    if (ticketType.quota !== null && (await seatsTaken(tx, ticketType.id)) + quantity > ticketType.quota) {
      return new SoldOut();
    }

    let invitationId: string | null = null;
    if (ticketType.kind === "invite") {
      if (!invitation) return new NotInvited();
      // locked, so it can't be revoked or re-addressed while this enrollment takes it
      const [locked] = await tx
        .select({ usedAt: eventInvitations.usedAt })
        .from(eventInvitations)
        .where(eq(eventInvitations.id, invitation.id))
        .for("update");
      if (!locked) return new NotInvited();
      if (locked.usedAt || (await invitationTaken(tx, invitation.id))) return new InvitationUsed();
      invitationId = invitation.id;
    }

    const paid = Number(ticketType.price) > 0;
    const status = ticketType.kind === "approval" ? "pending" : paid ? "awaiting_payment" : "confirmed";
    const [enrollment] = await tx
      .insert(enrollments)
      .values({
        eventId: event.id,
        ticketTypeId: ticketType.id,
        buyerId: buyer.id,
        quantity,
        unitPrice: ticketType.price,
        status,
        invitationId,
        expiresAt: status === "awaiting_payment" ? new Date(Date.now() + PAYMENT_HOLD_MS) : null,
      })
      .returning({ id: enrollments.id, invitationId: enrollments.invitationId });
    // uuidv7 ids sort in attendee order; the rows share one created_at
    await tx.insert(tickets).values(
      attendees.map((attendee) => ({ ...attendee, id: Bun.randomUUIDv7(), enrollmentId: enrollment!.id, code: ticketCode() })),
    );
    if (status === "confirmed") await markConfirmed(tx, enrollment!);
    return { id: enrollment!.id, confirmed: status === "confirmed" };
  });
  if (created instanceof Error) return created;
  // awaited (at most 10 mails); it never throws
  if (created.confirmed) await sendTicketMails(created.id);
  return getEnrollmentById(created.id);
}

async function getEnrollmentById(enrollmentId: string) {
  const [enrollment] = await loadEnrollments([enrollmentId]);
  return enrollment ?? new EnrollmentNotFound();
}

/** For its buyer, and the event's organizer and admins; anyone else gets a not-found. */
export async function getEnrollment(enrollmentId: string, viewer: Viewer) {
  const [row] = await db
    .select({ buyerId: enrollments.buyerId, organizerId: events.organizerId })
    .from(enrollments)
    .innerJoin(events, eq(events.id, enrollments.eventId))
    .where(eq(enrollments.id, enrollmentId));
  if (!row || (row.buyerId !== viewer.id && !manages(row, viewer))) return new EnrollmentNotFound();
  return getEnrollmentById(enrollmentId);
}

export async function listEventEnrollments(
  eventId: string,
  query: EnrollmentModel.EventsByEventIdEnrollmentsGet["Query"],
) {
  const { page = 1, pageSize = 10 } = query;
  const term = query.q?.trim();
  const pattern = term ? `%${escapeLike(term)}%` : undefined;
  const scope = and(
    eq(enrollments.eventId, eventId),
    query.ticketTypeId ? eq(enrollments.ticketTypeId, query.ticketTypeId) : undefined,
    pattern
      ? or(
          ilike(users.name, pattern),
          ilike(users.email, pattern),
          sql`exists (select 1 from ${tickets} where ${tickets.enrollmentId} = ${enrollments.id} and (${tickets.firstName} || ' ' || ${tickets.lastName} ilike ${pattern} or ${tickets.email} ilike ${pattern}))`,
        )
      : undefined,
  );
  const where = and(scope, query.status ? sql`${effectiveStatusSql} = ${query.status}` : undefined);

  const [rows, byStatus] = await Promise.all([
    db
      .select({ id: enrollments.id })
      .from(enrollments)
      .leftJoin(users, eq(users.id, enrollments.buyerId))
      .where(where)
      .orderBy(desc(enrollments.createdAt), asc(enrollments.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ status: effectiveStatusSql, total: count() })
      .from(enrollments)
      .leftJoin(users, eq(users.id, enrollments.buyerId))
      .where(scope)
      .groupBy(effectiveStatusSql),
  ]);
  const counts = { pending: 0, awaiting_payment: 0, confirmed: 0, rejected: 0, expired: 0 };
  for (const { status, total } of byStatus) counts[status] = total;
  const total = query.status ? counts[query.status] : byStatus.reduce((sum, row) => sum + row.total, 0);
  return { items: await loadEnrollments(rows.map((row) => row.id)), total, counts };
}

type MailOrder = { buyerEmail: string | null; buyerName: string | null; title: string; startsAt: Date; ticketType: string };

async function mailOrder(enrollmentId: string): Promise<MailOrder | undefined> {
  const [row] = await db
    .select({
      buyerEmail: users.email,
      buyerName: users.name,
      title: events.title,
      startsAt: events.startsAt,
      ticketType: ticketTypes.name,
    })
    .from(enrollments)
    .innerJoin(events, eq(events.id, enrollments.eventId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, enrollments.ticketTypeId))
    .leftJoin(users, eq(users.id, enrollments.buyerId))
    .where(eq(enrollments.id, enrollmentId));
  return row;
}

/** Mails the buyer about the organizer's decision. Never throws: the decision is already saved. */
async function mailDecision(enrollmentId: string, body: (order: MailOrder) => { subject: string; html: string }) {
  try {
    const order = await mailOrder(enrollmentId);
    if (!order?.buyerEmail) return;
    await enqueueMail({ to: order.buyerEmail, ...body(order) });
  } catch (error) {
    console.error("Failed to enqueue enrollment mail", error);
  }
}

const greeting = (order: MailOrder) => `<p>สวัสดีคุณ ${Bun.escapeHTML(order.buyerName ?? "")}</p>`;
const orderLine = (order: MailOrder) =>
  `ตั๋ว <strong>${Bun.escapeHTML(order.ticketType)}</strong> ของอีเวนต์ <strong>${Bun.escapeHTML(order.title)}</strong> (${formatMailTime(order.startsAt)})`;

/**
 * Approves a pending enrollment. A free one is confirmed and its tickets mailed; a paid one waits
 * for payment (APPROVED_PAYMENT_WINDOW_MS) and the buyer is asked to pay.
 */
export async function approveEnrollment(enrollmentId: string, reviewerId: string) {
  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).for("update");
    if (!current) return new EnrollmentNotFound();
    if (current.status !== "pending") return new EnrollmentNotPending();
    const paid = Number(current.unitPrice) > 0;
    const expiresAt = new Date(Date.now() + APPROVED_PAYMENT_WINDOW_MS);
    await tx
      .update(enrollments)
      .set({ reviewedBy: reviewerId, reviewedAt: new Date(), ...(paid ? { status: "awaiting_payment", expiresAt } : {}) })
      .where(eq(enrollments.id, enrollmentId));
    if (!paid) await markConfirmed(tx, current);
    return { paid, expiresAt };
  });
  if (result instanceof Error) return result;

  if (!result.paid) await sendTicketMails(enrollmentId);
  else {
    await mailDecision(enrollmentId, (order) => ({
      subject: `คำขอของคุณได้รับการอนุมัติ: ${order.title}`,
      html:
        greeting(order) +
        `<p>ผู้จัดงานอนุมัติคำขอ${orderLine(order)}แล้ว</p>` +
        `<p>กรุณาชำระเงินภายใน ${formatMailTime(result.expiresAt)} เพื่อรับตั๋ว</p>` +
        `<p><a href="${accountLink(`/tickets/orders/${enrollmentId}`, true)}">ชำระเงิน</a></p>`,
    }));
  }
  return getEnrollmentById(enrollmentId);
}

export async function rejectEnrollment(enrollmentId: string, reviewerId: string, note: string | undefined) {
  const [rejected] = await db
    .update(enrollments)
    .set({ status: "rejected", reviewedBy: reviewerId, reviewedAt: new Date() })
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.status, "pending")))
    .returning({ id: enrollments.id });
  if (!rejected) return new EnrollmentNotPending();

  const reason = note?.trim();
  await mailDecision(enrollmentId, (order) => ({
    subject: `คำขอของคุณไม่ได้รับการอนุมัติ: ${order.title}`,
    html:
      greeting(order) +
      `<p>ขออภัย ผู้จัดงานไม่ได้อนุมัติคำขอ${orderLine(order)}</p>` +
      (reason ? `<p>เหตุผลจากผู้จัดงาน: ${Bun.escapeHTML(reason)}</p>` : ""),
  }));
  return getEnrollmentById(enrollmentId);
}
