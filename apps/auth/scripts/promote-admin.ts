// Bootstraps the first admin: register through the web first, then
//   cd apps/auth && bun run admin:promote you@example.com
import { markUserRevoked } from "@app/auth-guard";
import { db, eq, users } from "@app/db";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: bun run admin:promote <email>");
  process.exit(1);
}

const [user] = await db
  .update(users)
  .set({ role: "admin" })
  .where(eq(users.email, email))
  .returning({ id: users.id });

if (!user) {
  console.error(`No user with email ${email}. Register it through the web app first.`);
  process.exit(1);
}

await markUserRevoked(user.id).catch((error) =>
  console.warn("Could not clear cached sessions; they refresh within 60s", error),
);
console.log(`${email} is now an admin. Sign in again (or reload) to see the dashboard.`);
// the postgres and redis connections would keep the process alive
process.exit(0);
