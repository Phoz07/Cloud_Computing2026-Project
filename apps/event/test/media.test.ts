import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AuthSession, Role } from "@app/auth-guard";

// Stand in for the auth service: the cookie header is the name of a seeded user.
// Copy the real exports before mocking, then rebuild the guard on a fake resolver.
const sessions = new Map<string, AuthSession>();
const resolve = async (headers: Headers) => sessions.get(headers.get("cookie") ?? "") ?? null;
const actual = { ...(await import("@app/auth-guard")) };
mock.module("@app/auth-guard", () => ({
  ...actual,
  authGuard: actual.createAuthGuard(resolve, "test"),
  authenticate: actual.createAuthenticator(resolve),
}));

// invite-only events email their invitees; never reach the real queue
mock.module("@app/mail", () => ({ enqueueMail: mock(async () => {}) }));

const { event: app } = await import("../src/app");
const { MAX_ASSETS_PER_EVENT } = await import("../src/routes/media/service");
const { db, eq, eventAssets, eventCategories, events, inArray, users } = await import("@app/db");
const { useMemoryStorage } = await import("@app/storage/testing");

// 1x1 transparent PNG
const png = Uint8Array.fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
);
const pngFile = () => new File([png], "photo.png", { type: "image/png" });

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
  return user!.id;
}

async function seedEvent(organizerId: string) {
  const [event] = await db
    .insert(events)
    .values({
      organizerId,
      categoryId,
      title: "Test",
      slug: `test-${crypto.randomUUID()}`,
      venue: "Test venue",
      startsAt: new Date(),
      endsAt: new Date(),
    })
    .returning({ id: events.id });
  eventIds.push(event!.id);
  return event!.id;
}

function request(method: string, path: string, as?: string, file?: File) {
  const headers: Record<string, string> = as ? { cookie: as } : {};
  let body: FormData | undefined;
  if (file) {
    body = new FormData();
    body.append("file", file);
  }
  return app.handle(new Request(`http://localhost/api/events${path}`, { method, headers, body }));
}

// response bodies are asserted field by field, so untyped is fine here
const json = (response: Response): Promise<any> => response.json();
const keyOf = (url: string) => url.replace(/^\/files\//, "");

let store: ReturnType<typeof useMemoryStorage>;
let eventId: string;
let otherEventId: string;

beforeAll(async () => {
  const [category] = await db
    .insert(eventCategories)
    .values({ name: `media-${runId}`, slug: `media-${runId}` })
    .returning({ id: eventCategories.id });
  categoryId = category!.id;
  const owner = await seedUser("owner", "organizer");
  const other = await seedUser("other", "organizer");
  await seedUser("admin", "admin");
  await seedUser("member", "user");
  eventId = await seedEvent(owner);
  otherEventId = await seedEvent(other);
});

beforeEach(() => {
  store = useMemoryStorage();
});

afterAll(async () => {
  await db.delete(events).where(inArray(events.id, eventIds));
  await db.delete(users).where(inArray(users.id, userIds));
  await db.delete(eventCategories).where(eq(eventCategories.id, categoryId));
});

describe("access", () => {
  test("requires a session", async () => {
    expect((await request("PUT", `/${eventId}/cover`, undefined, pngFile())).status).toBe(401);
  });

  test("plain users cannot change media", async () => {
    expect((await request("PUT", `/${eventId}/cover`, "member", pngFile())).status).toBe(403);
  });

  test("organizers cannot change another organizer's event", async () => {
    expect((await request("PUT", `/${eventId}/cover`, "other", pngFile())).status).toBe(403);
    expect((await request("POST", `/${eventId}/assets`, "other", pngFile())).status).toBe(403);
  });

  test("a missing event is 404", async () => {
    const missing = crypto.randomUUID();
    const response = await request("PUT", `/${missing}/cover`, "owner", pngFile());
    expect(response.status).toBe(404);
    expect((await json(response)).code).toBe("EVENT_NOT_FOUND");
    expect((await request("GET", `/${missing}/assets`)).status).toBe(404);
  });

  test("a malformed event id is rejected", async () => {
    expect((await request("PUT", "/not-a-uuid/cover", "owner", pngFile())).status).toBe(422);
  });
});

describe("cover", () => {
  const coverKey = async () =>
    (await db.select({ key: events.coverImageKey }).from(events).where(eq(events.id, eventId)))[0]
      ?.key;

  test("the organizer sets it, and an admin replaces it", async () => {
    const first = await request("PUT", `/${eventId}/cover`, "owner", pngFile());
    expect(first.status).toBe(200);
    const { coverUrl } = await json(first);
    expect(coverUrl).toStartWith(`/files/public/events/${eventId}/cover/`);
    expect(await coverKey()).toBe(keyOf(coverUrl));
    expect(await store.exists(keyOf(coverUrl))).toBeTrue();

    const second = await request("PUT", `/${eventId}/cover`, "admin", pngFile());
    expect(second.status).toBe(200);
    const replaced = (await json(second)).coverUrl;
    expect(await coverKey()).toBe(keyOf(replaced));
    expect(await store.exists(keyOf(coverUrl))).toBeFalse();
  });

  test("rejects a file that is not an image", async () => {
    const response = await request("PUT", `/${eventId}/cover`, "owner", new File(["hi"], "x.png"));
    expect(response.status).toBe(415);
    expect((await json(response)).code).toBe("UNSUPPORTED_FILE");
  });

  test("removing it clears the key and deletes the object", async () => {
    const { coverUrl } = await json(await request("PUT", `/${eventId}/cover`, "owner", pngFile()));

    const response = await request("DELETE", `/${eventId}/cover`, "owner");
    expect(await json(response)).toEqual({ coverUrl: null });
    expect(await coverKey()).toBeNull();
    expect(await store.exists(keyOf(coverUrl))).toBeFalse();
  });
});

describe("assets", () => {
  test("the organizer adds one and anyone can list it", async () => {
    const response = await request("POST", `/${eventId}/assets`, "owner", pngFile());
    expect(response.status).toBe(200);
    const asset = await json(response);
    expect(asset).toMatchObject({ contentType: "image/png", size: png.byteLength });
    expect(asset.url).toStartWith(`/files/public/events/${eventId}/assets/`);

    const list = await json(await request("GET", `/${eventId}/assets`));
    expect(list.map((item: { id: string }) => item.id)).toContain(asset.id);
  });

  test("deleting removes the row and the object, once", async () => {
    const asset = await json(await request("POST", `/${eventId}/assets`, "owner", pngFile()));

    expect((await request("DELETE", `/${eventId}/assets/${asset.id}`, "other")).status).toBe(403);
    const removed = await request("DELETE", `/${eventId}/assets/${asset.id}`, "owner");
    expect(removed.status).toBe(200);
    expect(await store.exists(keyOf(asset.url))).toBeFalse();

    const again = await request("DELETE", `/${eventId}/assets/${asset.id}`, "owner");
    expect(again.status).toBe(404);
    expect((await json(again)).code).toBe("ASSET_NOT_FOUND");
  });

  test("an asset can only be deleted through its own event", async () => {
    const asset = await json(await request("POST", `/${otherEventId}/assets`, "other", pngFile()));
    // the owner of eventId may manage eventId, but this asset belongs to otherEventId
    expect((await request("DELETE", `/${eventId}/assets/${asset.id}`, "owner")).status).toBe(404);
    expect(await store.exists(keyOf(asset.url))).toBeTrue();
  });

  test(`stops at ${MAX_ASSETS_PER_EVENT} images per event`, async () => {
    await db.delete(eventAssets).where(eq(eventAssets.eventId, eventId));
    for (let i = 0; i < MAX_ASSETS_PER_EVENT; i++) {
      expect((await request("POST", `/${eventId}/assets`, "owner", pngFile())).status).toBe(200);
    }

    const response = await request("POST", `/${eventId}/assets`, "owner", pngFile());
    expect(response.status).toBe(409);
    expect((await json(response)).code).toBe("ASSET_LIMIT_REACHED");
    expect((await json(await request("GET", `/${eventId}/assets`))).length).toBe(MAX_ASSETS_PER_EVENT);
  });
});
