import { Elysia, t } from "elysia";
import { authenticate, Forbidden } from "@app/auth-guard";
import { db, enrollments, eq, events } from "@app/db";
import { EnrollmentNotFound } from "@app/tickets";
import { can, manages } from "../libs/access";
import { EventNotFound, EventSuspended } from "../libs/errors";

/** Organizers (event: update) who organize `event`, or admins; the error to answer otherwise. */
async function authorize(request: Request, event: typeof events.$inferSelect) {
  const auth = await authenticate(request.headers);
  if (!("user" in auth)) return auth;
  if (!can(auth.user.role, { event: ["update"] }) || !manages(event, auth.user)) return new Forbidden();
  // like apps/event: a suspended event is frozen for its organizer, reads still answer
  if (event.status === "suspended" && !can(auth.user.role, { event: ["suspend"] }) && request.method !== "GET") {
    return new EventSuspended();
  }
  return auth;
}

/**
 * Route macros for an event's organizer and admins (apps/registration's, for this service's paths):
 * - `eventOwner: true` on `/events/:eventId/...` adds `user`, `session` and the loaded `event`
 * - `enrollmentManager: true` on `/enrollments/:id/...` adds them and the loaded `enrollment`
 * They authenticate by themselves because a macro can't read the auth-guard macros' derives.
 */
export const eventOwner = new Elysia({ name: "event-owner" }).macro({
  eventOwner: {
    params: t.Object({ eventId: t.String({ format: "uuid" }) }),
    async derive({ request, params }) {
      const [event] = await db.select().from(events).where(eq(events.id, params.eventId));
      if (!event) return new EventNotFound();
      const auth = await authorize(request, event);
      return "user" in auth ? { ...auth, event } : auth;
    },
  },
  enrollmentManager: {
    params: t.Object({ id: t.String({ format: "uuid" }) }),
    async derive({ request, params }) {
      const [row] = await db
        .select({ enrollment: enrollments, event: events })
        .from(enrollments)
        .innerJoin(events, eq(events.id, enrollments.eventId))
        .where(eq(enrollments.id, params.id));
      if (!row) return new EnrollmentNotFound();
      const auth = await authorize(request, row.event);
      return "user" in auth ? { ...auth, ...row } : auth;
    },
  },
});
