import { and, asc, db, desc, enrollments, eq, events, gt, or, sql, tickets, ticketTypes, users, type SQL } from "@app/db";
import type { Viewer } from "../../libs/access";
import { loadEnrollments, toEventSummary } from "../../libs/enrollments";
import { TicketNotFound } from "../../libs/errors";
import type * as TicketModel from "./model";

const confirmedTickets = (where: SQL | undefined) =>
  db
    .select({
      ticket: tickets,
      confirmedAt: enrollments.confirmedAt,
      buyerId: enrollments.buyerId,
      buyerName: users.name,
      event: events,
      ticketType: { id: ticketTypes.id, name: ticketTypes.name, kind: ticketTypes.kind },
    })
    .from(tickets)
    .innerJoin(enrollments, eq(enrollments.id, tickets.enrollmentId))
    .innerJoin(events, eq(events.id, enrollments.eventId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, enrollments.ticketTypeId))
    .leftJoin(users, eq(users.id, enrollments.buyerId))
    .where(and(eq(enrollments.status, "confirmed"), where));

type Row = Awaited<ReturnType<typeof confirmedTickets>>[number];

/** Tickets the viewer bought, or that carry their email (Better Auth and tickets store it lowercase). */
const visibleTo = (viewer: Viewer) => or(eq(enrollments.buyerId, viewer.id), eq(tickets.email, viewer.email.toLowerCase()));

const toTicket = (row: Row, viewer: Viewer): TicketModel.Ticket => {
  const isBuyer = row.buyerId === viewer.id;
  return {
    id: row.ticket.id,
    enrollmentId: row.ticket.enrollmentId,
    code: row.ticket.code,
    firstName: row.ticket.firstName,
    lastName: row.ticket.lastName,
    email: row.ticket.email,
    answers: row.ticket.answers,
    confirmedAt: (row.confirmedAt ?? row.ticket.createdAt).toISOString(),
    event: toEventSummary(row.event),
    ticketType: row.ticketType,
    isBuyer,
    boughtBy: isBuyer || !row.buyerName ? null : { name: row.buyerName },
  };
};

export async function listMine(viewer: Viewer) {
  const [rows, pending] = await Promise.all([
    confirmedTickets(visibleTo(viewer)).orderBy(asc(events.startsAt), asc(tickets.createdAt), asc(tickets.id)),
    db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.buyerId, viewer.id),
          or(
            eq(enrollments.status, "pending"),
            and(eq(enrollments.status, "awaiting_payment"), gt(enrollments.expiresAt, sql`now()`)),
          ),
        ),
      )
      .orderBy(desc(enrollments.createdAt)),
  ]);
  return {
    orders: await loadEnrollments(pending.map((row) => row.id)),
    tickets: rows.map((row) => toTicket(row, viewer)),
  };
}

/** A confirmed ticket, for its buyer and its attendee; a not-found for anyone else. */
export async function getTicket(ticketId: string, viewer: Viewer) {
  const [row] = await confirmedTickets(and(eq(tickets.id, ticketId), visibleTo(viewer)));
  return row ? toTicket(row, viewer) : new TicketNotFound();
}
