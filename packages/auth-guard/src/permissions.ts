import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

// Browser-safe: apps/web imports this through "@app/auth-guard/permissions".
// Better Auth's user/session statements plus the Eventide domain ones.
// Ownership (an organizer touching only their own events) is checked by the services, not here.
export const statement = {
  ...defaultStatements,
  event: ["create", "update", "delete", "manage-all"],
  ticket: ["check-in"],
  "organizer-application": ["apply", "review"],
} as const;

export const ac = createAccessControl(statement);

// Only admins get user-management powers (ban = suspend, set-role = approve organizer).
export const roles = {
  user: ac.newRole({
    ...userAc.statements,
    "organizer-application": ["apply"],
  }),
  organizer: ac.newRole({
    ...userAc.statements,
    event: ["create", "update", "delete"],
    ticket: ["check-in"],
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    event: ["create", "update", "delete", "manage-all"],
    ticket: ["check-in"],
    "organizer-application": ["review"],
  }),
};

export type Role = keyof typeof roles;

export const roleNames = Object.keys(roles) as Role[];

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && Object.hasOwn(roles, value);

export type Permissions = {
  [K in keyof typeof statement]?: (typeof statement)[K][number][];
};
