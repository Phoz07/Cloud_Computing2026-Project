import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { accounts, db, sessions, users, verifications } from "@app/db";
import { enqueueMail } from "@app/mail";
import { ac, roles } from "./permissions";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

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
  socialProviders:
    googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {},
  plugins: [admin({ ac, roles })],
});
