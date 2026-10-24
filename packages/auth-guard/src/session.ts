import { redis } from "bun";
import { isRole, type Role } from "./permissions";

// The narrow identity every service sees. Never widen it with the raw Better Auth objects.
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
};

export type AuthSession = {
  user: AuthUser;
  session: { id: string; expiresAt: Date };
};

// What Better Auth returns, from get-session JSON (dates as strings) or auth.api.getSession (Dates).
export type RawSession = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string | null;
    banned?: boolean | null;
  };
  session: { id: string; expiresAt: string | Date };
};

const SESSION_COOKIES = ["__Secure-better-auth.session_token", "better-auth.session_token"];
const CACHE_TTL_SECONDS = 60;
// Must outlive the cache TTL so every entry fetched before a revocation expires first.
const REVOKED_TTL_SECONDS = 120;
// Entries fetched up to this long after a revocation are also treated as stale, to absorb clock skew.
const CLOCK_SKEW_MS = 5_000;

const authServiceUrl = process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";

const sessionKey = (cookie: string) =>
  `auth:session:${new Bun.CryptoHasher("sha256").update(cookie).digest("hex")}`;
const revokedKey = (userId: string) => `auth:revoked:${userId}`;

export function toAuthSession(raw: RawSession | null | undefined): AuthSession | null {
  if (!raw?.user || !raw.session || raw.user.banned) return null;
  const { user, session } = raw;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      role: isRole(user.role) ? user.role : "user",
    },
    session: { id: session.id, expiresAt: new Date(session.expiresAt) },
  };
}

function readSessionCookie(cookieHeader: string) {
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator).trim();
    if (SESSION_COOKIES.includes(name)) return pair.slice(separator + 1).trim();
  }
  return null;
}

/**
 * Resolves the caller from the Better Auth session cookie.
 * Checks the Redis cache first; on a miss, asks the auth service and caches the answer.
 * Throws when the auth service can't be reached.
 */
export async function getSession(headers: Headers): Promise<AuthSession | null> {
  const cookieHeader = headers.get("cookie");
  const token = cookieHeader ? readSessionCookie(cookieHeader) : null;
  if (!cookieHeader || !token) return null;

  const key = sessionKey(token);
  const cached = await readCache(key);
  if (cached) return cached;

  const fetchedAt = Date.now();
  const session = await introspect(cookieHeader);
  if (session) await writeCache(key, fetchedAt, session);
  return session;
}

/** Makes every cached session of this user stale. Called by the auth service on ban, role change and sign-out. */
export async function markUserRevoked(userId: string) {
  await redis.set(revokedKey(userId), String(Date.now()), "EX", REVOKED_TTL_SECONDS);
}

async function introspect(cookie: string) {
  // disableRefresh: services only read sessions; the web's own get-session call extends them.
  const response = await fetch(`${authServiceUrl}/api/auth/get-session?disableRefresh=true`, {
    headers: { cookie },
  });
  if (!response.ok) throw new Error(`Auth service responded ${response.status}`);
  return toAuthSession((await response.json()) as RawSession | null);
}

// Redis failures fall through to the auth service: slower, never wrong.
async function readCache(key: string) {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { fetchedAt: number; data: AuthSession };
    const revokedAt = Number((await redis.get(revokedKey(entry.data.user.id))) ?? 0);
    if (entry.fetchedAt < revokedAt + CLOCK_SKEW_MS) return null;

    const expiresAt = new Date(entry.data.session.expiresAt);
    if (expiresAt.getTime() <= Date.now()) return null;
    return { ...entry.data, session: { ...entry.data.session, expiresAt } };
  } catch (error) {
    console.error("Session cache read failed", error);
    return null;
  }
}

async function writeCache(key: string, fetchedAt: number, data: AuthSession) {
  const secondsLeft = Math.floor((data.session.expiresAt.getTime() - Date.now()) / 1000);
  const ttl = Math.min(CACHE_TTL_SECONDS, secondsLeft);
  if (ttl <= 0) return;
  try {
    await redis.set(key, JSON.stringify({ fetchedAt, data }), "EX", ttl);
  } catch (error) {
    console.error("Session cache write failed", error);
  }
}
