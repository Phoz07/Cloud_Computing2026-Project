import { and, asc, db, enrollments, eq, events, min, seatHolds, sql, ticketTypes } from "@app/db";
import { activeEnrollment, activeHold, invitationTaken } from "@app/tickets";
import { eventAccess, findInvitation, type Viewer } from "../../libs/access";
import { effectiveStatusSql } from "../../libs/enrollments";
import { EventNotFound } from "../../libs/errors";
import type * as AvailabilityModel from "./model";

const ticketsSum = sql<number>`coalesce(sum(${enrollments.quantity}), 0)`.mapWith(Number);

/**
 * Seats per ticket type of the event, in the event service's order, and when the next payment
 * hold or seat hold runs out (the counts change then without anything being written).
 */
export async function countSeats(eventId: string) {
  const [types, enrolled, holds] = await Promise.all([
    db
      .select({ id: ticketTypes.id, quota: ticketTypes.quota })
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId))
      .orderBy(asc(ticketTypes.createdAt), asc(ticketTypes.id)),
    db
      .select({
        ticketTypeId: enrollments.ticketTypeId,
        status: effectiveStatusSql,
        total: ticketsSum,
        firstExpiry: min(enrollments.expiresAt),
      })
      .from(enrollments)
      .where(and(eq(enrollments.eventId, eventId), activeEnrollment()))
      .groupBy(enrollments.ticketTypeId, effectiveStatusSql),
    db
      .select({
        ticketTypeId: seatHolds.ticketTypeId,
        total: sql<number>`coalesce(sum(${seatHolds.quantity}), 0)`.mapWith(Number),
        firstExpiry: min(seatHolds.expiresAt),
      })
      .from(seatHolds)
      .where(and(eq(seatHolds.eventId, eventId), activeHold()))
      .groupBy(seatHolds.ticketTypeId),
  ]);

  const enrolledIn = (ticketTypeId: string, status: string) =>
    enrolled.find((row) => row.ticketTypeId === ticketTypeId && row.status === status)?.total ?? 0;
  const seats = types.map((type): AvailabilityModel.Seats => {
    const confirmed = enrolledIn(type.id, "confirmed");
    const reserved = enrolledIn(type.id, "awaiting_payment");
    const pending = enrolledIn(type.id, "pending");
    const held = holds.find((row) => row.ticketTypeId === type.id)?.total ?? 0;
    const remaining = type.quota === null ? null : Math.max(0, type.quota - confirmed - reserved - pending - held);
    return { ticketTypeId: type.id, confirmed, reserved, pending, held, remaining };
  });
  // only payment holds and seat holds expire; other enrollments' expires_at is null
  const expiries = [...enrolled, ...holds].flatMap((row) => (row.firstExpiry ? [row.firstExpiry.getTime()] : []));
  return { seats, nextLapse: expiries.length ? new Date(Math.min(...expiries)) : null };
}

/** How `viewer` may open the event (eventAccess) and their invitation, or the error GET /api/events/:id answers. */
async function viewEvent(eventId: string, viewer: Viewer | null) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) return new EventNotFound();
  const invitation = viewer ? await findInvitation(event.id, viewer.email) : null;
  const access = eventAccess(event, viewer, !!invitation);
  return access instanceof Error ? access : { access, invitation };
}

/** Whoever may open the event may watch its seats; anyone else gets the error. */
export async function seatsAccess(eventId: string, viewer: Viewer | null) {
  const view = await viewEvent(eventId, viewer);
  return view instanceof Error ? view : null;
}

/** Seats and what `viewer` can do, per ticket type of the event, in the event service's order. */
export async function getAvailability(eventId: string, viewer: Viewer | null) {
  const view = await viewEvent(eventId, viewer);
  if (view instanceof Error) return view;
  const { access, invitation } = view;

  const [types, { seats }, mine, holds, invitationUsed] = await Promise.all([
    db
      .select({ id: ticketTypes.id, kind: ticketTypes.kind, maxPerUser: ticketTypes.maxPerUser })
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId)),
    countSeats(eventId),
    viewer
      ? db
          .select({ ticketTypeId: enrollments.ticketTypeId, total: ticketsSum })
          .from(enrollments)
          .where(and(eq(enrollments.eventId, eventId), eq(enrollments.buyerId, viewer.id), activeEnrollment()))
          .groupBy(enrollments.ticketTypeId)
      : [],
    viewer
      ? db
          .select({ ticketTypeId: seatHolds.ticketTypeId, quantity: seatHolds.quantity, expiresAt: seatHolds.expiresAt })
          .from(seatHolds)
          .where(and(eq(seatHolds.eventId, eventId), eq(seatHolds.holderId, viewer.id), activeHold()))
      : [],
    invitation ? invitation.usedAt !== null || invitationTaken(db, invitation.id) : false,
  ]);

  return seats.flatMap((seat): AvailabilityModel.Availability[] => {
    const type = types.find((candidate) => candidate.id === seat.ticketTypeId);
    // created or deleted between the two reads
    if (!type) return [];
    const owned = mine.find((row) => row.ticketTypeId === type.id)?.total ?? 0;
    const held = holds.find((row) => row.ticketTypeId === type.id);
    const hold = held ? { quantity: held.quantity, expiresAt: held.expiresAt.toISOString() } : null;
    // keep in step with withLiveSeats() in apps/web/src/lib/live-seats.ts, which re-derives sold_out from pushed seats;
    // the viewer's own hold keeps it open for them, since it may be what took the last seats
    const state: AvailabilityModel.State =
      access !== "open"
        ? "closed"
        : type.kind === "invite" && !invitation
          ? "invite_only"
          : owned >= type.maxPerUser
            ? "limit_reached"
            : type.kind === "invite" && invitationUsed
              ? "invitation_used"
              : seat.remaining === 0 && !hold
                ? "sold_out"
                : "open";
    return [{ ...seat, mine: owned, hold, state }];
  });
}
