import { roles, type Permissions, type Role } from "@app/auth-guard";
import { and, db, eq, eventInvitations, events } from "@app/db";
import { EventNotFound, InviteOnly } from "./errors";

export type Viewer = { id: string; email: string; role: Role };

type EventRow = typeof events.$inferSelect;

/** Whether `role` holds every permission statement in `permissions` (see auth-guard's permissions.ts). */
export const can = (role: Role, permissions: Permissions) => roles[role].authorize(permissions).success;

/** The event's organizer, or an admin. */
export const manages = (event: Pick<EventRow, "organizerId">, viewer: Viewer | null) =>
  !!viewer && (viewer.id === event.organizerId || can(viewer.role, { event: ["manage-all"] }));

/** The invitation for `email` (Better Auth stores emails lowercase, and so do invitations). */
export async function findInvitation(eventId: string, email: string) {
  const [row] = await db
    .select({ id: eventInvitations.id, usedAt: eventInvitations.usedAt })
    .from(eventInvitations)
    .where(and(eq(eventInvitations.eventId, eventId), eq(eventInvitations.email, email.toLowerCase())));
  return row ?? null;
}

/**
 * Whether `viewer` may enroll in the event ("open"), only look at it as its organizer or an admin
 * ("preview": a draft, scheduled, suspended or ended event), or not see it at all (the error, the
 * same GET /api/events/:id answers). Keep in step with isVisibleTo and findVisibleEvent in
 * apps/event/src/routes/events/service.ts.
 */
export function eventAccess(event: EventRow, viewer: Viewer | null, invited: boolean) {
  const now = new Date();
  const published = event.status === "public" && (event.publishAt === null || event.publishAt <= now);
  const reachable = published || (event.status === "invite" && invited);
  if (!reachable && !manages(event, viewer)) {
    // says it's invite-only (and nothing else), so an invitee knows to sign in with the invited email
    return event.status === "invite" ? new InviteOnly() : new EventNotFound();
  }
  return reachable && event.endsAt > now ? ("open" as const) : ("preview" as const);
}
