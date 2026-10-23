import { asc, db, enrollments, eq, events, inArray, sql, tickets, ticketTypes, users } from "@app/db";
import { fileUrl } from "@app/storage";
import { effectiveStatus } from "@app/tickets";
import type * as EnrollmentModel from "../routes/enrollments/model";

type EventRow = typeof events.$inferSelect;

const iso = (date: Date | null) => date?.toISOString() ?? null;

export const toEventSummary = (event: EventRow): EnrollmentModel.EventSummary => ({
  id: event.id,
  slug: event.slug,
  title: event.title,
  venue: event.venue,
  startsAt: event.startsAt.toISOString(),
  endsAt: event.endsAt.toISOString(),
  thumbnailUrl: event.coverImageKey ? fileUrl(event.coverImageKey) : null,
});

/** The status as read: `awaiting_payment` past its hold is `expired` (effectiveStatus, in SQL). */
export const effectiveStatusSql = sql<EnrollmentModel.Status>`(case when ${enrollments.status} = 'awaiting_payment' and ${enrollments.expiresAt} <= now() then 'expired' else ${enrollments.status}::text end)`;

/** Enrollments with their event, ticket type, buyer and tickets, in the order of `ids`. */
export async function loadEnrollments(ids: string[]): Promise<EnrollmentModel.Enrollment[]> {
  if (ids.length === 0) return [];
  const [rows, ticketRows] = await Promise.all([
    db
      .select({
        enrollment: enrollments,
        event: events,
        ticketType: { id: ticketTypes.id, name: ticketTypes.name, kind: ticketTypes.kind },
        buyer: { id: users.id, name: users.name, email: users.email },
      })
      .from(enrollments)
      .innerJoin(events, eq(events.id, enrollments.eventId))
      .innerJoin(ticketTypes, eq(ticketTypes.id, enrollments.ticketTypeId))
      .leftJoin(users, eq(users.id, enrollments.buyerId))
      .where(inArray(enrollments.id, ids)),
    db
      .select()
      .from(tickets)
      .where(inArray(tickets.enrollmentId, ids))
      .orderBy(asc(tickets.createdAt), asc(tickets.id)),
  ]);
  const byId = new Map(rows.map((row) => [row.enrollment.id, row]));

  return ids.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const { enrollment } = row;
    const status = effectiveStatus(enrollment);
    const unitPrice = Number(enrollment.unitPrice);
    return {
      id: enrollment.id,
      status,
      quantity: enrollment.quantity,
      unitPrice,
      total: unitPrice * enrollment.quantity,
      expiresAt: status === "awaiting_payment" ? iso(enrollment.expiresAt) : null,
      createdAt: enrollment.createdAt.toISOString(),
      reviewedAt: iso(enrollment.reviewedAt),
      confirmedAt: iso(enrollment.confirmedAt),
      event: toEventSummary(row.event),
      ticketType: row.ticketType,
      buyer: row.buyer,
      tickets: ticketRows
        .filter((ticket) => ticket.enrollmentId === id)
        .map((ticket) => ({
          id: ticket.id,
          firstName: ticket.firstName,
          lastName: ticket.lastName,
          email: ticket.email,
          code: status === "confirmed" ? ticket.code : null,
          answers: ticket.answers,
        })),
    };
  });
}
