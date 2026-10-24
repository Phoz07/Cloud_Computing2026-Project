import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
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

// invite-only events email their invitees; never reach the real queue
mock.module("@app/mail", () => ({ enqueueMail: mock(async () => {}) }));

const { event: app } = await import("../src/app");
const { db, eq, eventAssets, eventCategories, events, inArray, users } = await import("@app/db");
const { useMemoryStorage } = await import("@app/storage/testing");

const runId = crypto.randomUUID().slice(0, 8);
const userIds: string[] = [];
const eventIds: string[] = [];
const categoryIds: string[] = [];
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

const json = (response: Response): Promise<any> => response.json();

function request(method: string, path: string, as?: string, body?: unknown) {
  const headers: Record<string, string> = as ? { cookie: as } : {};
  if (body !== undefined) headers["content-type"] = "application/json";
  return app.handle(
    new Request(`http://localhost/api/events${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

const startsAt = new Date(Date.now() + 86_400_000).toISOString();
const endsAt = new Date(Date.now() + 2 * 86_400_000).toISOString();

async function create(as: string, extra: Record<string, unknown> = {}) {
  const response = await request("POST", "/", as, {
    title: "Concert",
    categoryId,
    venue: "Hall",
    startsAt,
    endsAt,
    ...extra,
  });
  const body = await json(response);
  if (response.status === 200) eventIds.push(body.id);
  return { response, body };
}

beforeAll(async () => {
  await seedUser("owner", "organizer");
  await seedUser("other", "organizer");
  await seedUser("admin", "admin");
  await seedUser("member", "user");
  const [category] = await db
    .insert(eventCategories)
    .values({ name: `cat-${runId}`, slug: `cat-${runId}` })
    .returning({ id: eventCategories.id });
  categoryId = category!.id;
  categoryIds.push(categoryId);
});

beforeEach(() => {
  useMemoryStorage();
});

afterAll(async () => {
  await db.delete(events).where(inArray(events.id, eventIds));
  await db.delete(eventCategories).where(inArray(eventCategories.id, categoryIds));
  await db.delete(users).where(inArray(users.id, userIds));
});

describe("create", () => {
  test("creates a draft owned by the caller, with a generated slug", async () => {
    const { response, body } = await create("owner");
    expect(response.status).toBe(200);
    expect(body.status).toBe("draft");
    expect(body.slug).toMatch(/^concert-[0-9a-f]{6}$/);
    expect(body.category.id).toBe(categoryId);
  });

  test("plain users and anonymous callers cannot create", async () => {
    expect((await create("member")).response.status).toBe(403);
    expect(
      (await request("POST", "/", undefined, { title: "x", categoryId, venue: "v", startsAt, endsAt })).status,
    ).toBe(401);
  });

  test("rejects a taken slug, a reserved slug and a bad schedule", async () => {
    const slug = `taken-${runId}`;
    expect((await create("owner", { slug })).response.status).toBe(200);
    const taken = await create("other", { slug });
    expect(taken.response.status).toBe(409);
    expect(taken.body.code).toBe("SLUG_TAKEN");
    expect((await create("owner", { slug: "mine" })).body.code).toBe("INVALID_SLUG");
    expect((await create("owner", { startsAt: endsAt, endsAt: startsAt })).body.code).toBe("INVALID_SCHEDULE");
  });

  test("rejects an unknown category", async () => {
    const { body } = await create("owner", { categoryId: crypto.randomUUID() });
    expect(body.code).toBe("CATEGORY_NOT_FOUND");
  });

  test("trims text and rejects whitespace-only titles", async () => {
    const { body } = await create("owner", { title: "  Spaced  ", venue: " Hall ", venueDescription: "   " });
    expect(body.title).toBe("Spaced");
    expect(body.venue).toBe("Hall");
    expect(body.venueDescription).toBeNull();
    expect((await create("owner", { title: "   " })).response.status).toBe(422);
  });
});

describe("slug availability", () => {
  test("reports taken, free and own slugs", async () => {
    const slug = `avail-${runId}`;
    const { body } = await create("owner", { slug });
    expect(await json(await request("GET", `/slug-available?slug=${slug}`, "owner"))).toEqual({ available: false });
    expect(await json(await request("GET", `/slug-available?slug=${slug}&excludeId=${body.id}`, "owner"))).toEqual({
      available: true,
    });
    expect(await json(await request("GET", `/slug-available?slug=free-${runId}`, "owner"))).toEqual({
      available: true,
    });
    expect((await request("GET", `/slug-available?slug=${slug}`)).status).toBe(401);
  });
});

describe("update", () => {
  test("owner edits; others are refused; admin may edit any", async () => {
    const { body } = await create("owner");
    const ok = await request("PATCH", `/${body.id}`, "owner", { title: "Renamed", venueUrl: "https://example.com" });
    expect((await json(ok)).title).toBe("Renamed");
    expect((await request("PATCH", `/${body.id}`, "other", { title: "x" })).status).toBe(403);
    expect((await request("PATCH", `/${body.id}`, "admin", { title: "By admin" })).status).toBe(200);
  });

  test("validates refund policy and non-http venue urls", async () => {
    const { body } = await create("owner");
    expect((await json(await request("PATCH", `/${body.id}`, "owner", { isRefundAvailable: true }))).code).toBe(
      "INVALID_REFUND",
    );
    const ok = await json(
      await request("PATCH", `/${body.id}`, "owner", {
        isRefundAvailable: true,
        refundCutoffHours: 48,
        refundPercent: 80,
      }),
    );
    expect(ok.refundPercent).toBe(80);
    const off = await json(await request("PATCH", `/${body.id}`, "owner", { isRefundAvailable: false }));
    expect(off.refundPercent).toBeNull();
    expect((await request("PATCH", `/${body.id}`, "owner", { venueUrl: "javascript:alert(1)" })).status).toBe(422);
  });

  test("sanitizes the description", async () => {
    const { body } = await create("owner");
    const own = `/files/public/events/${body.id}/assets/${crypto.randomUUID()}`;
    const html =
      '<p onclick="x()">hi</p><script>alert(1)</script>' +
      '<img src="https://evil.example/a.png">' +
      `<img src="/files/public/events/${body.id}/assets/../../../../api/auth/sign-out">` +
      `<img src="/files/public/events/${crypto.randomUUID()}/assets/${crypto.randomUUID()}">` +
      `<img src="${own}" alt="a"><a href="javascript:alert(1)">l</a>`;
    const { description } = await json(await request("PATCH", `/${body.id}`, "owner", { description: html }));
    expect(description).not.toContain("script");
    expect(description).not.toContain("onclick");
    expect(description).not.toContain("evil.example");
    expect(description).not.toContain("sign-out");
    expect(description).not.toContain("javascript:");
    // only this event's own gallery image survives
    expect(description.match(/<img/g)).toHaveLength(1);
    expect(description).toContain(own);
  });

  test("an empty description is stored as null", async () => {
    const { body } = await create("owner");
    const { description } = await json(await request("PATCH", `/${body.id}`, "owner", { description: "<script>x</script>" }));
    expect(description).toBeNull();
  });

  test("only admins can suspend; a suspended event is frozen for its owner", async () => {
    const { body } = await create("owner");
    const refused = await request("PATCH", `/${body.id}`, "owner", { status: "suspended" });
    expect(refused.status).toBe(403);
    expect((await json(refused)).code).toBe("SUSPEND_FORBIDDEN");
    expect((await json(await request("PATCH", `/${body.id}`, "admin", { status: "suspended" }))).status).toBe(
      "suspended",
    );
    const frozen = await request("PATCH", `/${body.id}`, "owner", { status: "public" });
    expect(frozen.status).toBe(403);
    expect((await json(frozen)).code).toBe("EVENT_SUSPENDED");
    expect((await request("DELETE", `/${body.id}`, "owner")).status).toBe(403);
    // the cover and gallery are frozen too
    const file = new FormData();
    file.append("file", new File([new Uint8Array([0])], "x.png", { type: "image/png" }));
    const cover = await app.handle(
      new Request(`http://localhost/api/events/${body.id}/cover`, { method: "PUT", headers: { cookie: "owner" }, body: file }),
    );
    expect((await json(cover)).code).toBe("EVENT_SUSPENDED");
    // the owner can still see it (to know why); the public can't
    expect((await request("GET", `/${body.id}`, "owner")).status).toBe(200);
    expect((await request("GET", `/${body.id}`)).status).toBe(404);
    // an admin can still edit it, and lift the suspension
    expect((await request("PATCH", `/${body.id}`, "admin", { title: "Moderated" })).status).toBe(200);
    expect((await json(await request("PATCH", `/${body.id}`, "admin", { status: "draft" }))).status).toBe("draft");
  });

  test("partial updates keep the fields that were not sent", async () => {
    const { body } = await create("owner", { venueDescription: "Floor 5" });
    const updated = await json(await request("PATCH", `/${body.id}`, "owner", { title: "Only title" }));
    expect(updated.title).toBe("Only title");
    expect(updated.venueDescription).toBe("Floor 5");
    expect(updated.startsAt).toBe(body.startsAt);
    // a schedule change is checked against the stored other end
    const bad = await request("PATCH", `/${body.id}`, "owner", { endsAt: body.startsAt });
    expect((await json(bad)).code).toBe("INVALID_SCHEDULE");
  });
});

describe("visibility", () => {
  test("draft, scheduled and suspended are hidden from the public", async () => {
    const draft = (await create("owner")).body;
    const scheduled = (await create("owner")).body;
    await request("PATCH", `/${scheduled.id}`, "owner", {
      status: "public",
      publishAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect((await request("GET", `/${draft.id}`)).status).toBe(404);
    expect((await request("GET", `/${scheduled.slug}`)).status).toBe(404);
    expect((await request("GET", `/${draft.id}`, "other")).status).toBe(404);
    expect((await request("GET", `/${draft.id}`, "owner")).status).toBe(200);
    expect((await request("GET", `/${draft.id}`, "admin")).status).toBe(200);
  });

  test("public events are listed and found by slug; invite-only ones are never listed", async () => {
    const pub = (await create("owner", { title: `Pub ${runId}` })).body;
    const invite = (await create("owner", { title: `Invite ${runId}` })).body;
    await request("PATCH", `/${pub.id}`, "owner", { status: "public" });
    await request("PATCH", `/${invite.id}`, "owner", { status: "invite" });

    expect((await json(await request("GET", `/${pub.slug}`))).id).toBe(pub.id);
    // invite-only says so (without details) to everyone not invited
    const anonymous = await request("GET", `/${invite.slug}`);
    expect(anonymous.status).toBe(403);
    expect(await json(anonymous)).not.toHaveProperty("venue");
    expect((await json(await request("GET", `/${invite.slug}`, "member"))).code).toBe("INVITE_ONLY");
    expect((await request("GET", `/${invite.slug}`, "other")).status).toBe(403);
    expect((await request("GET", `/${invite.slug}`, "owner")).status).toBe(200);
    expect((await request("GET", `/${invite.id}`, "admin")).status).toBe(200);

    const list = await json(await request("GET", `/?q=${runId}&categoryId=${categoryId}`));
    expect(list.items.map((e: { id: string }) => e.id)).toEqual([pub.id]);
    expect(list.total).toBe(1);
  });

  test("the public list shows upcoming events by default and past ones on request", async () => {
    const tag = `when-${runId}`;
    const ended = (await create("owner", {
      title: `Ended ${tag}`,
      startsAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      endsAt: new Date(Date.now() - 86_400_000).toISOString(),
    })).body;
    const soon = (await create("owner", { title: `Soon ${tag}` })).body;
    await request("PATCH", `/${ended.id}`, "owner", { status: "public" });
    await request("PATCH", `/${soon.id}`, "owner", { status: "public" });

    const ids = async (query: string) =>
      (await json(await request("GET", `/?q=${tag}${query}`))).items.map((e: { id: string }) => e.id);
    expect(await ids("")).toEqual([soon.id]);
    expect(await ids("&when=past")).toEqual([ended.id]);
  });

  test("the public list can show one organizer's events", async () => {
    const tag = `by-${runId}`;
    const mine = (await create("owner", { title: `Mine ${tag}` })).body;
    const theirs = (await create("other", { title: `Theirs ${tag}` })).body;
    await request("PATCH", `/${mine.id}`, "owner", { status: "public" });
    await request("PATCH", `/${theirs.id}`, "other", { status: "public" });
    const list = await json(await request("GET", `/?q=${tag}&organizerId=${mine.organizerId}`));
    expect(list.items.map((e: { id: string }) => e.id)).toEqual([mine.id]);
  });

  test("search matches the venue too", async () => {
    const venue = `Arena-${runId}`;
    const event = (await create("owner", { venue })).body;
    await request("PATCH", `/${event.id}`, "owner", { status: "public" });
    const list = await json(await request("GET", `/?q=${venue}`));
    expect(list.items.map((e: { id: string }) => e.id)).toEqual([event.id]);
  });

  test("/mine shows an organizer only their own events", async () => {
    const mine = (await create("owner")).body;
    const theirs = (await create("other")).body;
    const ids = async (as: string) =>
      (await json(await request("GET", "/mine?pageSize=50", as))).items.map((e: { id: string }) => e.id);
    expect(await ids("owner")).toContain(mine.id);
    expect(await ids("owner")).not.toContain(theirs.id);
    expect(await ids("admin")).toEqual(expect.arrayContaining([mine.id, theirs.id]));
    expect((await request("GET", "/mine", "member")).status).toBe(403);
  });

  test("/mine counts every status, whatever the status filter", async () => {
    const tag = `count-${runId}`;
    const a = (await create("other", { title: `A ${tag}` })).body;
    await create("other", { title: `B ${tag}` });
    await request("PATCH", `/${a.id}`, "other", { status: "invite" });

    const result = await json(await request("GET", `/mine?q=${tag}&status=invite`, "other"));
    expect(result.items.map((e: { id: string }) => e.id)).toEqual([a.id]);
    expect(result.total).toBe(1);
    expect(result.counts).toEqual({ draft: 1, public: 0, invite: 1, suspended: 0 });
  });
});

describe("delete", () => {
  test("removes the event with its gallery and stored files", async () => {
    const store = useMemoryStorage();
    const { body } = await create("owner");
    const key = `public/events/${body.id}/assets/${crypto.randomUUID()}`;
    await store.upload(key, new Blob(["x"], { type: "image/png" }));
    await db.insert(eventAssets).values({ eventId: body.id, key, contentType: "image/png", size: 1 });

    expect((await request("DELETE", `/${body.id}`, "other")).status).toBe(403);
    expect((await request("DELETE", `/${body.id}`, "owner")).status).toBe(200);
    expect((await request("GET", `/${body.id}`, "owner")).status).toBe(404);
    expect(await db.select().from(eventAssets).where(eq(eventAssets.eventId, body.id))).toHaveLength(0);
    expect(await store.exists(key)).toBeFalse();
  });
});
