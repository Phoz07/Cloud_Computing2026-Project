import { ac, roles } from "@app/auth-guard/permissions";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Better Auth's own client: sign-in, sessions, accounts and the admin API.
// Our custom auth-service routes (organizer applications, providers) go through the Eden `authClient` in api.ts.
// baseURL defaults to the page origin; the Vite proxy forwards /api/auth to the auth service.
export const auth = createAuthClient({
  plugins: [adminClient({ ac, roles })],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
