import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { accounts, db, eq, events, sessions, users, verifications } from "@app/db";
import { markUserRevoked } from "@app/auth-guard";
import { ac, roles } from "@app/auth-guard/permissions";
import { enqueueMail } from "@app/mail";
import { deleteFile, ownedKey } from "@app/storage";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const googleEnabled = Boolean(googleClientId && googleClientSecret);

// Other services cache sessions in Redis (see @app/auth-guard). Marking the user revoked makes
// those caches stale, so a ban, role change or sign-out applies on the very next request.
// A Redis outage must not block the auth action itself, so failures are only logged.
export const revokeCachedSessions = async (userId: string) => {
  try {
    await markUserRevoked(userId);
  } catch (error) {
    console.error("Failed to mark user revoked; cached sessions stay valid until they expire", error);
  }
};

// events.organizer_id is ON DELETE RESTRICT, and Better Auth deletes a user's sessions and
// accounts before the user row, so a delete the FK would block must be refused up front;
// otherwise the user is left without any way to sign in.
async function refuseIfOrganizesEvents(userId: string) {
  const [owned] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.organizerId, userId))
    .limit(1);
  if (owned) {
    throw new APIError("FORBIDDEN", {
      code: "ORGANIZER_HAS_EVENTS",
      message: "Transfer or delete this user's events first",
    });
  }
}

// baseURL and secret come from BETTER_AUTH_URL / BETTER_AUTH_SECRET.
export const auth = betterAuth({
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: { users, sessions, accounts, verifications },
  }),
  advanced: { database: { generateId: "uuid" } },
  emailAndPassword: {
    enabled: true,
    // Not awaited so response timing doesn't reveal whether the email exists.
    sendResetPassword: async ({ user, url }) => {
      enqueueMail({
        to: user.email,
        subject: "รีเซ็ตรหัสผ่าน Eventide",
        html: `<p>กดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่</p><p><a href="${url}">ตั้งรหัสผ่านใหม่</a></p><p>หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องดำเนินการใดๆ</p>`,
      }).catch((error) => console.error("Failed to enqueue reset password mail", error));
    },
  },
  user: {
    // Password users confirm with their password; Google-only users need a fresh session.
    deleteUser: {
      enabled: true,
      // an admin deleting themselves could leave the system with nobody to approve organizers
      beforeDelete: async (user) => {
        if ((user as { role?: string }).role === "admin") {
          throw new APIError("FORBIDDEN", { message: "ADMIN_CANNOT_DELETE_SELF" });
        }
        await refuseIfOrganizesEvents(user.id);
      },
    },
  },
  socialProviders: googleEnabled
    ? { google: { clientId: googleClientId!, clientSecret: googleClientSecret! } }
    : {},
  // Defaults kept on purpose: linking is enabled, but a Google sign-in is only merged into an
  // existing account whose email is verified locally. Email verification isn't set up, so a
  // password user gets `account_not_linked` and links Google from their profile while signed in.
  // This stops someone who pre-registers a victim's email from receiving the victim's Google login.
  account: { accountLinking: { enabled: true } },
  hooks: {
    // the admin plugin's remove-user skips user.deleteUser.beforeDelete
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/admin/remove-user" && typeof ctx.body?.userId === "string") {
        await refuseIfOrganizesEvents(ctx.body.userId);
      }
    }),
  },
  databaseHooks: {
    // setRole, banUser and unbanUser all update the user row
    user: {
      update: { after: (user) => revokeCachedSessions(user.id) },
      delete: {
        after: async (user) => {
          await revokeCachedSessions(user.id);
          await deleteFile(ownedKey(user.image, "avatar", user.id));
        },
      },
    },
    // sign-out, revoke-session(s) and the bulk delete on ban; runs once per deleted row
    session: {
      delete: { after: (session) => revokeCachedSessions(session.userId) },
    },
  },
  plugins: [admin({ ac, roles })],
});
