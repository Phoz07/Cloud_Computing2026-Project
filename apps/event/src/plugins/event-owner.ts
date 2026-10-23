import { Elysia, t } from "elysia";
import { authenticate, Forbidden, roles, type Permissions, type Role } from "@app/auth-guard";
import { db, eq, events } from "@app/db";
import { EventNotFound } from "../libs/errors";

const can = (role: Role, permissions: Permissions) => roles[role].authorize(permissions).success;

/**
 * `eventOwner: true` on a `/:id/...` route lets through the event's organizer and admins
 * (`event: ["manage-all"]`), and adds `user`, `session` and the loaded `event` to the context.
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
      return { ...auth, event };
    },
  },
});
