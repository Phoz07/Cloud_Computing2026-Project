import { Elysia } from "elysia";
import { AuthUnavailable, Forbidden, Unauthorized } from "./errors";
import { roles, type Permissions, type Role } from "./permissions";
import { getSession, type AuthSession } from "./session";

export type SessionResolver = (headers: Headers) => Promise<AuthSession | null>;

/**
 * The caller's session, or the error to return. For a service's own macros (e.g. an ownership
 * check): macros can't read each other's derives, so such a macro authenticates by itself.
 */
export function createAuthenticator(resolve: SessionResolver) {
  return async function authenticate(headers: Headers) {
    try {
      return (await resolve(headers)) ?? new Unauthorized();
    } catch (error) {
      console.error("Failed to resolve session", error);
      return new AuthUnavailable();
    }
  };
}

/**
 * Route macros backed by `resolve`:
 * - `auth: true` requires a session
 * - `role: ["organizer", "admin"]` also requires one of the roles
 * - `permission: { event: ["create"] }` also requires the permission statements
 * Each adds `user` and `session` to the context. Macros can't read each other's derives,
 * so every macro resolves the session itself.
 */
export function createAuthGuard(resolve: SessionResolver, seed: string) {
  const authenticate = createAuthenticator(resolve);

  return new Elysia({ name: "auth-guard", seed }).macro({
    auth: {
      async derive({ request }) {
        return authenticate(request.headers);
      },
    },
    role: (allowed: Role[]) => ({
      async derive({ request }) {
        const result = await authenticate(request.headers);
        if (!("user" in result)) return result;
        if (!allowed.includes(result.user.role)) return new Forbidden();
        return result;
      },
    }),
    permission: (permissions: Permissions) => ({
      async derive({ request }) {
        const result = await authenticate(request.headers);
        if (!("user" in result)) return result;
        if (!roles[result.user.role].authorize(permissions).success) return new Forbidden();
        return result;
      },
    }),
  });
}

/** For every service except apps/auth: resolves sessions through the auth service with a Redis cache. */
export const authGuard = createAuthGuard(getSession, "remote");
export const authenticate = createAuthenticator(getSession);
