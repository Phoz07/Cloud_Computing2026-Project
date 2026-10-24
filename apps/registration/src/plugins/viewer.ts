import { Elysia } from "elysia";
import { authenticate } from "@app/auth-guard";

/**
 * `viewer: true` adds `viewer` (the signed-in user, or null) without requiring a session,
 * for public routes whose answer depends on who asks. If the auth service is down the caller
 * is treated as anonymous, so public pages keep working.
 */
export const viewer = new Elysia({ name: "viewer" }).macro({
  viewer: {
    async derive({ request }) {
      const auth = await authenticate(request.headers);
      return { viewer: "user" in auth ? auth.user : null };
    },
  },
});
