import { roles, type Permissions, type Role } from "@app/auth-guard";
import type { events } from "@app/db";

/** Whether `role` holds every permission statement in `permissions` (see auth-guard's permissions.ts). */
export const can = (role: Role, permissions: Permissions) => roles[role].authorize(permissions).success;

/** The event's organizer, or an admin. */
export const manages = (event: Pick<typeof events.$inferSelect, "organizerId">, viewer: { id: string; role: Role }) =>
  viewer.id === event.organizerId || can(viewer.role, { event: ["manage-all"] });
