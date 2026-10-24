import { Elysia, t } from "elysia";
import { authenticate, Forbidden } from "@app/auth-guard";
import { db, eq, events } from "@app/db";
import { can, canModerate } from "../libs/access";
import { EventNotFound, EventSuspended } from "../libs/errors";

/**
 * `eventOwner: true` on a `/:id/...` route lets through the event's organizer and admins
 * (`event: ["manage-all"]`), and adds `user`, `session` and the loaded `event` to the context.
 * A suspended event is frozen for its organizer: every write (details, cover, gallery, invitations,
 * delete) is refused until an admin lifts the suspension, while reads (GET) still answer.
 * Services that write re-check under a row lock.
 * It authenticates by itself because a macro can't read the auth-guard macros' derives.
 */
export const eventOwner = new Elysia({ name: "event-owner" }).macro({
  eventOwner: {
    params: t.Object({ id: t.String({ format: "uuid" }) }),
    async derive({ request, params }) {
      const auth = await authenticate(request.headers);
      if (!("user" in auth)) return auth;
      const { id: userId, role } = auth.user;
      if (!can(role, { event: ["update"] })) return new Forbidden();

      const [event] = await db.select().from(events).where(eq(events.id, params.id));
      if (!event) return new EventNotFound();
      if (event.organizerId !== userId && !can(role, { event: ["manage-all"] })) {
        return new Forbidden();
      }
      if (event.status === "suspended" && !canModerate(role) && request.method !== "GET") {
        return new EventSuspended();
      }
      return { ...auth, event };
    },
  },
});
