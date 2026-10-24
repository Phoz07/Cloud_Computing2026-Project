import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

// The images are public and read events anonymously, so no session is ever resolved
const actual = { ...(await import("@app/auth-guard")) };
const resolve = async () => null;
mock.module("@app/auth-guard", () => ({
  ...actual,
  authGuard: actual.createAuthGuard(resolve, "test"),
  authenticate: actual.createAuthenticator(resolve),
}));
mock.module("@app/mail", () => ({ enqueueMail: mock(async () => {}) }));

const { event: app } = await import("../src/app");
const { db, eq, eventCategories, events, inArray, users } = await import("@app/db");
const { useMemoryStorage } = await import("@app/storage/testing");

// 1x1 transparent PNG
const png = Uint8Array.fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
);

const runId = crypto.randomUUID().slice(0, 8);
const eventIds: string[] = [];
let organizerId: string;
let categoryId: string;
let categorySlug: string;
let store: ReturnType<typeof useMemoryStorage>;

const hour = 3_600_000;
const later = (hours: number) => new Date(Date.now() + hours * hour);

async function seedEvent(values: Partial<typeof events.$inferInsert> = {}) {
  const [event] = await db
    .insert(events)
    .values({
      organizerId,
      categoryId,
      title: "เทศกาลดนตรีริมทะเลสาบ",
      slug: `og-${crypto.randomUUID()}`,
      venue: "สวนลุมพินี",
      status: "public",
      startsAt: later(24),
      endsAt: later(27),
      ...values,
    })
    .returning({ id: events.id, slug: events.slug });
  eventIds.push(event!.id);
  return event!;
}

/** Stores `bytes` as the event's cover, the way the media routes would. */
async function withCover(eventId: string, bytes: Uint8Array) {
  const key = `public/events/${eventId}/cover/${crypto.randomUUID()}`;
  await store.upload(key, bytes);
  await db.update(events).set({ coverImageKey: key }).where(eq(events.id, eventId));
}

const get = (path: string) => app.handle(new Request(`http://localhost/api/events/og${path}`));

async function expectJpeg(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(response.headers.get("cache-control")).toStartWith("public, max-age=");
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
}

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({ name: "og", email: `og-${runId}@example.com`, role: "organizer" })
    .returning({ id: users.id });
  organizerId = user!.id;
  categorySlug = `og-${runId}`;
  const [category] = await db
    .insert(eventCategories)
    .values({ name: `ดนตรี ${runId}`, slug: categorySlug })
    .returning({ id: eventCategories.id });
  categoryId = category!.id;
});

beforeEach(() => {
  store = useMemoryStorage();
});

afterAll(async () => {
  await db.delete(events).where(inArray(events.id, eventIds));
  await db.delete(eventCategories).where(eq(eventCategories.id, categoryId));
  await db.delete(users).where(eq(users.id, organizerId));
});

describe("site", () => {
  test("renders the brand card", async () => {
    await expectJpeg(await get("/site"));
  });
});

describe("events", () => {
  test("renders a public event by id and by slug", async () => {
    const event = await seedEvent();
    await withCover(event.id, png);
    await expectJpeg(await get(`/events/${event.id}?v=abc`));
    await expectJpeg(await get(`/events/${event.slug}`));
  });

  test("renders without a cover, and when the cover is missing from storage", async () => {
    await expectJpeg(await get(`/events/${(await seedEvent()).id}`));
    const event = await seedEvent({ coverImageKey: `public/events/${crypto.randomUUID()}/cover/${crypto.randomUUID()}` });
    await expectJpeg(await get(`/events/${event.id}`));
  });

  test("still renders when the cover doesn't decode", async () => {
    const event = await seedEvent();
    await withCover(event.id, new TextEncoder().encode("not an image"));
    await expectJpeg(await get(`/events/${event.id}`));
  });

  test("hidden events answer like missing ones", async () => {
    const hidden = await Promise.all([
      seedEvent({ status: "draft" }),
      seedEvent({ status: "invite" }),
      seedEvent({ status: "suspended" }),
      seedEvent({ publishAt: later(1) }),
    ]);
    for (const event of hidden) {
      const response = await get(`/events/${event.slug}`);
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).not.toBe("image/jpeg");
    }
    expect((await get(`/events/${crypto.randomUUID()}`)).status).toBe(404);
  });
});

describe("categories", () => {
  test("renders with the covers of upcoming events", async () => {
    for (let i = 0; i < 2; i++) await withCover((await seedEvent()).id, png);
    await expectJpeg(await get(`/categories/${categorySlug}`));
  });

  test("a missing category is 404", async () => {
    expect((await get(`/categories/missing-${runId}`)).status).toBe(404);
  });
});
