import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { redis } from "bun";
import { Elysia } from "elysia";
import { authGuard, createAuthGuard, getSession, markUserRevoked, type AuthSession } from "../src";

const userId = crypto.randomUUID();

const rawSession = (role: string) => ({
  user: { id: userId, name: "Test", email: "test@example.com", image: null, role, banned: false },
  session: { id: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
});

const app = new Elysia()
  .use(authGuard)
  .get("/me", { auth: true }, ({ user }) => user)
  .get("/admin", { role: ["admin"] }, ({ user }) => user.role)
  .get("/create-event", { permission: { event: ["create"] } }, () => "ok");

let cookie: string;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

const request = (path: string, withCookie = true) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      headers: withCookie ? { cookie: `theme=dark; better-auth.session_token=${cookie}` } : {},
    }),
  );

// fetch's type carries extra statics (preconnect), so cast the stub
const mockFetch = (impl: () => Promise<Response>) =>
  fetchSpy.mockImplementation(impl as unknown as typeof fetch);

const answerWith = (body: unknown) => mockFetch(async () => Response.json(body));

beforeEach(() => {
  // a fresh cookie per test keeps cache entries from leaking between tests
  cookie = `${crypto.randomUUID()}.signature`;
  fetchSpy = spyOn(globalThis, "fetch");
});

afterEach(() => fetchSpy.mockRestore());

afterAll(async () => {
  await redis.del(`auth:revoked:${userId}`);
});

describe("auth macro", () => {
  test("rejects a request without the session cookie and never calls the auth service", async () => {
    const response = await request("/me", false);
    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("rejects when the auth service has no session for the cookie", async () => {
    answerWith(null);
    expect((await request("/me")).status).toBe(401);
  });

  test("returns the narrow user for a valid session", async () => {
    answerWith(rawSession("user"));
    const response = await request("/me");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: userId,
      name: "Test",
      email: "test@example.com",
      image: null,
      role: "user",
    });
  });

  test("returns 503 when the auth service is unreachable", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed");
    });
    expect((await request("/me")).status).toBe(503);
  });

  test("treats a banned user as signed out", async () => {
    answerWith({ ...rawSession("user"), user: { ...rawSession("user").user, banned: true } });
    expect((await request("/me")).status).toBe(401);
  });
});

describe("role and permission macros", () => {
  test("forbids a role outside the allowed list", async () => {
    answerWith(rawSession("organizer"));
    expect((await request("/admin")).status).toBe(403);
  });

  test("allows a listed role", async () => {
    answerWith(rawSession("admin"));
    const response = await request("/admin");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("admin");
  });

  test("checks permission statements against the role", async () => {
    answerWith(rawSession("user"));
    expect((await request("/create-event")).status).toBe(403);

    cookie = `${crypto.randomUUID()}.signature`;
    answerWith(rawSession("organizer"));
    expect((await request("/create-event")).status).toBe(200);
  });
});

describe("session cache", () => {
  test("serves the second request from Redis", async () => {
    answerWith(rawSession("user"));
    await request("/me");
    await request("/me");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("asks the auth service again after the user is revoked", async () => {
    answerWith(rawSession("admin"));
    expect((await request("/admin")).status).toBe(200);

    await markUserRevoked(userId);
    answerWith(rawSession("user"));
    expect((await request("/admin")).status).toBe(403);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test("getSession forwards the whole cookie header with disableRefresh", async () => {
    answerWith(rawSession("user"));
    await getSession(new Headers({ cookie: `better-auth.session_token=${cookie}` }));
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toEndWith("/api/auth/get-session?disableRefresh=true");
    expect(new Headers(init?.headers).get("cookie")).toBe(`better-auth.session_token=${cookie}`);
  });
});

test("createAuthGuard works with a local resolver", async () => {
  const session: AuthSession = {
    user: { id: userId, name: "Local", email: "local@example.com", image: null, role: "organizer" },
    session: { id: "s", expiresAt: new Date(Date.now() + 60_000) },
  };
  const local = new Elysia()
    .use(createAuthGuard(async () => session, "test"))
    .get("/", { role: ["organizer"] }, ({ user }) => user.name);
  const response = await local.handle(new Request("http://localhost/"));
  expect(await response.text()).toBe("Local");
});
