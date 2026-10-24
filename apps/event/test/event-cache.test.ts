import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { redis } from "bun";
import type { AuthSession, Role } from "@app/auth-guard";

// Stand in for the auth service: the cookie header is the name of a seeded user.
const sessions = new Map<string, AuthSession>();
const resolve = async (headers: Headers) => sessions.get(headers.get("cookie") ?? "") ?? null;
const actual = { ...(await import("@app/auth-guard")) };
mock.module("@app/auth-guard", () => ({
  ...actual,
  authGuard: actual.createAuthGuard(resolve, "test"),
  authenticate: actual.createAuthenticator(resolve),
}));

mock.module("@app/mail", () => ({ enqueueMail: mock(async () => {}) }));

const { event: app } = await import("../src/app");
const { cacheEvent, refreshCachedEvent } = await import("../src/libs/event-cache");
const { db, eq, eventCategories, events, inArray, users } = await import("@app/db");
const { useMemoryStorage } = await import("@app/storage/testing");

// 1x1 transparent PNG
const png = Uint8Array.fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
);

const runId = crypto.randomUUID().slice(0, 8);
const userIds: string[] = [];
const eventIds: string[] = [];
let categoryId: string;

async function seedUser(name: string, role: Role) {
  const [user] = await db
    .insert(users)
    .values({ name, email: `${name}-${runId}@example.com`, role })
    .returning({ id: users.id, email: users.email });
  userIds.push(user!.id);
  sessions.set(name, {
    user: { id: user!.id, name, email: user!.email, image: null, role },
    session: { id: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3_600_000) },
  });
}

const json = (response: Response): Promise<any> => response.json();

function request(method: string, path: string, as?: string, body?: unknown) {
  const headers: Record<string, string> = as ? { cookie: as } : {};
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  return app.handle(new Request(`http://localhost/api/events${path}`, { method, headers, body: payload }));
}

/** A published event of the owner's, as the API answers it. */
async function publicEvent() {
  const created = await json(
    await request("POST", "/", "owner", {
      title: "Concert",
      categoryId,
      venue: "Hall",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    }),
  );
  eventIds.push(created.id);
  return json(await request("PATCH", `/${created.id}`, "owner", { status: "public" }));
}

const cachedTitle = async (id: string) => {
  const raw = await redis.get(`event:id:${id}`);
  return raw === null || raw === "gone" ? raw : JSON.parse(raw).title;
};

beforeAll(async () => {
  await seedUser("owner", "organizer");
  await seedUser("admin", "admin");
  const [category] = await db
    .insert(eventCategories)
    .values({ name: `cat-cache-${runId}`, slug: `cat-cache-${runId}` })
    .returning({ id: eventCategories.id });
  categoryId = category!.id;
});

beforeEach(() => {
  useMemoryStorage();
});

afterAll(async () => {
  await db.delete(events).where(inArray(events.id, eventIds));
  await db.delete(eventCategories).where(eq(eventCategories.id, categoryId));
  await db.delete(users).where(inArray(users.id, userIds));
});

describe("event cache", () => {
  test("a read caches the event, and the next reads come from Redis", async () => {
    const event = await publicEvent();
    await redis.del(`event:id:${event.id}`, `event:slug:${event.slug}`);

    expect((await json(await request("GET", `/${event.slug}`))).title).toBe("Concert");
    expect(await cachedTitle(event.id)).toBe("Concert");
    expect(await redis.get(`event:slug:${event.slug}`)).toBe(event.id);

    // changed behind the service's back: the cached copy still answers
    await db.update(events).set({ title: "Changed in SQL" }).where(eq(events.id, event.id));
    expect((await json(await request("GET", `/${event.slug}`))).title).toBe("Concert");
    expect((await json(await request("GET", `/${event.id}`))).title).toBe("Concert");
  });

  test("an organizer's update replaces the cached copy, so the very next read sees it", async () => {
    const event = await publicEvent();
    expect((await json(await request("GET", `/${event.slug}`))).title).toBe("Concert");

    expect((await request("PATCH", `/${event.id}`, "owner", { title: "Concert (moved)" })).status).toBe(200);
    expect(await cachedTitle(event.id)).toBe("Concert (moved)");
    expect((await json(await request("GET", `/${event.slug}`))).title).toBe("Concert (moved)");

    // a read that fetched the old copy before the update can't put it back
    await cacheEvent({ ...event, title: "Concert" });
    expect((await json(await request("GET", `/${event.slug}`))).title).toBe("Concert (moved)");
  });

  test("a new slug finds the event and the old one doesn't", async () => {
    const event = await publicEvent();
    const slug = `renamed-${runId}`;
    expect((await request("PATCH", `/${event.id}`, "owner", { slug })).status).toBe(200);
    expect((await request("GET", `/${slug}`)).status).toBe(200);
    expect((await request("GET", `/${event.slug}`)).status).toBe(404);
    expect(await redis.get(`event:slug:${event.slug}`)).toBeNull();
  });

  test("hiding an event takes effect at once: a draft is the owner's again", async () => {
    const event = await publicEvent();
    expect((await request("GET", `/${event.slug}`)).status).toBe(200);
    expect((await request("PATCH", `/${event.id}`, "owner", { status: "draft" })).status).toBe(200);
    expect((await request("GET", `/${event.slug}`)).status).toBe(404);
    expect((await request("GET", `/${event.slug}`, "owner")).status).toBe(200);
  });

  test("a deleted event stays deleted, even against a read or an update that raced the delete", async () => {
    const event = await publicEvent();
    expect((await request("GET", `/${event.id}`)).status).toBe(200);
    expect((await request("DELETE", `/${event.id}`, "owner")).status).toBe(200);
    expect(await cachedTitle(event.id)).toBe("gone");

    await cacheEvent(event);
    await refreshCachedEvent(event);
    expect((await request("GET", `/${event.id}`)).status).toBe(404);
    expect((await request("GET", `/${event.slug}`)).status).toBe(404);
  });

  test("a new cover shows in the cached event right away", async () => {
    const event = await publicEvent();
    expect((await json(await request("GET", `/${event.slug}`))).thumbnailUrl).toBeNull();

    const form = new FormData();
    form.append("file", new File([png], "cover.png", { type: "image/png" }));
    const { coverUrl } = await json(await request("PUT", `/${event.id}/cover`, "owner", form));
    expect((await json(await request("GET", `/${event.slug}`))).thumbnailUrl).toBe(coverUrl);

    expect((await request("DELETE", `/${event.id}/cover`, "owner")).status).toBe(200);
    expect((await json(await request("GET", `/${event.slug}`))).thumbnailUrl).toBeNull();
  });

  test("renaming a category drops the cached events that carry its old name", async () => {
    const event = await publicEvent();
    expect((await json(await request("GET", `/${event.slug}`))).category.name).toBe(`cat-cache-${runId}`);

    const name = `cat-cache-renamed-${runId}`;
    expect((await request("PATCH", `/categories/${categoryId}`, "admin", { name })).status).toBe(200);
    expect((await json(await request("GET", `/${event.slug}`))).category.name).toBe(name);
  });
});
