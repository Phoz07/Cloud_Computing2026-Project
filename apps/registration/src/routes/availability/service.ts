import { and, asc, db, enrollments, eq, events, sql, ticketTypes } from "@app/db";
import { activeEnrollment, invitationTaken } from "@app/tickets";
import { eventAccess, findInvitation, type Viewer } from "../../libs/access";
import { effectiveStatusSql } from "../../libs/enrollments";
import { EventNotFound } from "../../libs/errors";
import type * as AvailabilityModel from "./model";

const ticketsSum = sql<number>`coalesce(sum(${enrollments.quantity}), 0)`.mapWith(Number);

/** Seats and what `viewer` can do, per ticket type of the event, in the event service's order. */
export async function getAvailability(eventId: string, viewer: Viewer | null) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) return new EventNotFound();
  const invitation = viewer ? await findInvitation(event.id, viewer.email) : null;
  const access = eventAccess(event, viewer, !!invitation);
  if (access instanceof Error) return access;

  const [types, held, mine, invitationUsed] = await Promise.all([
    db
      .select({ id: ticketTypes.id, kind: ticketTypes.kind, quota: ticketTypes.quota, maxPerUser: ticketTypes.maxPerUser })
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId))
      .orderBy(asc(ticketTypes.createdAt), asc(ticketTypes.id)),
    db
      .select({ ticketTypeId: enrollments.ticketTypeId, status: effectiveStatusSql, total: ticketsSum })
      .from(enrollments)
      .where(and(eq(enrollments.eventId, eventId), activeEnrollment()))
      .groupBy(enrollments.ticketTypeId, effectiveStatusSql),
    viewer
      ? db
          .select({ ticketTypeId: enrollments.ticketTypeId, total: ticketsSum })
          .from(enrollments)
          .where(and(eq(enrollments.eventId, eventId), eq(enrollments.buyerId, viewer.id), activeEnrollment()))
          .groupBy(enrollments.ticketTypeId)
      : [],
    invitation ? invitation.usedAt !== null || invitationTaken(db, invitation.id) : false,
  ]);

  const heldOf = (ticketTypeId: string, status: string) =>
    held.find((row) => row.ticketTypeId === ticketTypeId && row.status === status)?.total ?? 0;

  return types.map((type): AvailabilityModel.Availability => {
    const confirmed = heldOf(type.id, "confirmed");
    const reserved = heldOf(type.id, "awaiting_payment");
    const pending = heldOf(type.id, "pending");
    const remaining = type.quota === null ? null : Math.max(0, type.quota - confirmed - reserved - pending);
    const owned = mine.find((row) => row.ticketTypeId === type.id)?.total ?? 0;
    const state: AvailabilityModel.State =
      access !== "open"
        ? "closed"
        : type.kind === "invite" && !invitation
          ? "invite_only"
          : owned >= type.maxPerUser
            ? "limit_reached"
            : type.kind === "invite" && invitationUsed
              ? "invitation_used"
              : remaining === 0
                ? "sold_out"
                : "open";
    return { ticketTypeId: type.id, confirmed, reserved, pending, remaining, mine: owned, state };
  });
}
