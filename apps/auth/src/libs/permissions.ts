import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

export const ac = createAccessControl(defaultStatements);

// Only admins get user-management powers (ban = suspend, set-role = approve organizer).
// Event ownership for organizers is enforced by the services, not by these statements.
export const roles = {
  user: ac.newRole(userAc.statements),
  organizer: ac.newRole(userAc.statements),
  admin: ac.newRole(adminAc.statements),
};
