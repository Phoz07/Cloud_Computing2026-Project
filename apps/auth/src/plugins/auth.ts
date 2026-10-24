import { createAuthGuard, toAuthSession } from "@app/auth-guard";
import { auth } from "../libs/auth";

// Same macros as the other services (auth / role / permission), but this service owns the
// session tables, so it asks Better Auth directly instead of calling itself over HTTP.
export const authGuard = createAuthGuard(
  async (headers) => toAuthSession(await auth.api.getSession({ headers })),
  "local",
);
