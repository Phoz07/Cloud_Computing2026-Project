import { roles, type Permissions, type Role } from "@app/auth-guard";

/** Whether `role` holds every permission statement in `permissions` (see auth-guard's permissions.ts). */
export const can = (role: Role, permissions: Permissions) => roles[role].authorize(permissions).success;

/** Admins: suspend or lift a suspension, and keep editing a suspended event. */
export const canModerate = (role: Role) => can(role, { event: ["suspend"] });
