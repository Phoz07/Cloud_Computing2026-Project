import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { AuthSession, Role } from "@app/auth-guard";

mock.module("@app/mail", () => ({ enqueueMail: mock(async () => {}) }));

// Stand in for the auth service: the cookie header is the name of a seeded user.
const sessions = new Map<string, AuthSession>();
const resolve = async (headers: Headers) => sessions.get(headers.get("cookie") ?? "") ?? null;
const actual = { ...(await import("@app/auth-guard")) };
mock.module("@app/auth-guard", () => ({
  ...actual,
  authGuard: actual.createAuthGuard(resolve, "test"),
  authenticate: actual.createAuthenticator(resolve),
}));

const { event: app } = await import("../src/app");
const { db, enrollments, eq, eventCategories, eventInvitations, events, inArray, users } = await import("@app/db");

const runId = crypto.randomUUID().slice(0, 8);
const userIds: string[] = [];
const eventIds: string[] = [];
let categoryId: string;

const emailOf = (name: string) => `${name}-${runId}@example.com`;

async function seedUser(name: string, role: Role) {
  const [user] = await db
    .insert(users)
    .values({ name, email: emailOf(name), role })
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

async function createEvent(status = "public", as = "owner") {
  const response = await request("POST", "/", as, {
    title: "Concert",
    categoryId,
    venue: "Hall",
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  });
  const body = await json(response);
  eventIds.push(body.id);
  if (status !== "draft") await request("PATCH", `/${body.id}`, as, { status });
  return body as { id: string; slug: string };
}

const base = { kind: "first_come", name: "Standard", price: 0, quota: 10, maxPerUser: 2, questions: [] };

const createType = (eventId: string, body: Record<string, unknown> = {}, as = "owner") =>
  request("POST", `/${eventId}/ticket-types`, as, { ...base, ...body });

const updateType = (eventId: string, ticketTypeId: string, body: Record<string, unknown>, as = "owner") =>
  request("PATCH", `/${eventId}/ticket-types/${ticketTypeId}`, as, body);

/** An enrollment row, as apps/registration would make it. */
async function enroll(eventId: string, ticketTypeId: string, quantity: number, status: "confirmed" | "rejected" = "confirmed") {
  await db.insert(enrollments).values({
    eventId,
    ticketTypeId,
    buyerId: userIds[3],
    quantity,
    unitPrice: "0",
    status,
  });
}

beforeAll(async () => {
  await seedUser("owner", "organizer");
  await seedUser("other", "organizer");
  await seedUser("admin", "admin");
  await seedUser("guest", "user");
  const [category] = await db
    .insert(eventCategories)
    .values({ name: `cat-tt-${runId}`, slug: `cat-tt-${runId}` })
    .returning({ id: eventCategories.id });
  categoryId = category!.id;
});

afterAll(async () => {
  await db.delete(enrollments).where(inArray(enrollments.eventId, eventIds));
  await db.delete(events).where(inArray(events.id, eventIds));
  await db.delete(eventCategories).where(eq(eventCategories.id, categoryId));
  await db.delete(users).where(inArray(users.id, userIds));
});

describe("create", () => {
  test("creates each kind; only first_come keeps a quota", async () => {
    const event = await createEvent();
    const first = await json(await createType(event.id, { name: "  Early bird  ", price: 500 }));
    expect(first).toMatchObject({ kind: "first_come", name: "Early bird", price: 500, quota: 10, maxPerUser: 2 });

    const approval = await json(await createType(event.id, { kind: "approval", quota: 50 }));
    expect(approval).toMatchObject({ kind: "approval", quota: null });
    const invite = await json(await createType(event.id, { kind: "invite", quota: undefined }));
    expect(invite).toMatchObject({ kind: "invite", quota: null });
  });

  test("first_come needs a quota; a paid price is at least ฿20", async () => {
    const event = await createEvent();
    const noQuota = await createType(event.id, { quota: null });
    expect(noQuota.status).toBe(422);
    expect((await json(noQuota)).code).toBe("INVALID_QUOTA");
    const cheap = await createType(event.id, { price: 19 });
    expect(cheap.status).toBe(422);
    expect((await json(cheap)).code).toBe("INVALID_PRICE");
    expect((await createType(event.id, { price: 20 })).status).toBe(200);
    expect((await createType(event.id, { price: 10.5 })).status).toBe(422);
    expect((await createType(event.id, { maxPerUser: 11 })).status).toBe(422);
  });

  test("keeps questions in order; a choice needs 2+ distinct options, other types drop options", async () => {
    const event = await createEvent();
    const questions = [
      { type: "choice", label: "Size", required: true, options: ["S", "M", "L"] },
      { type: "short_text", label: "Company", required: false, options: ["ignored", "too"] },
      { type: "long_text", label: "Why?", required: false },
    ];
    const created = await json(await createType(event.id, { questions }));
    expect(created.questions.map((q: any) => [q.label, q.options])).toEqual([
      ["Size", ["S", "M", "L"]],
      ["Company", null],
      ["Why?", null],
    ]);

    const one = await createType(event.id, { questions: [{ type: "choice", label: "X", required: false, options: ["A"] }] });
    expect((await json(one)).code).toBe("INVALID_QUESTION");
    const dup = await createType(event.id, { questions: [{ type: "choice", label: "X", required: false, options: ["A", " A "] }] });
    expect((await json(dup)).code).toBe("INVALID_QUESTION");
  });

  test("only the owner or an admin; a suspended event is frozen for its organizer", async () => {
    const event = await createEvent();
    expect((await createType(event.id, {}, "other")).status).toBe(403);
    expect((await createType(event.id, {}, "guest")).status).toBe(403);
    expect((await request("POST", `/${event.id}/ticket-types`, undefined, base)).status).toBe(401);
    expect((await createType(event.id, {}, "admin")).status).toBe(200);

    await request("PATCH", `/${event.id}`, "admin", { status: "suspended" });
    expect((await json(await createType(event.id))).code).toBe("EVENT_SUSPENDED");
  });
});

describe("update", () => {
  test("replaces questions: kept ids stay, missing ones go, new ones are added, order follows the list", async () => {
    const event = await createEvent();
    const created = await json(
      await createType(event.id, {
        questions: [
          { type: "short_text", label: "A", required: false },
          { type: "short_text", label: "B", required: false },
          { type: "short_text", label: "C", required: false },
        ],
      }),
    );
    const [a, , c] = created.questions;
    const response = await updateType(event.id, created.id, {
      questions: [
        { ...c, label: "C2", required: true },
        { type: "choice", label: "New", required: false, options: ["x", "y"] },
        { id: a.id, type: "short_text", label: "A", required: false },
      ],
    });
    expect(response.status).toBe(200);
    const { questions } = await json(response);
    expect(questions.map((q: any) => q.label)).toEqual(["C2", "New", "A"]);
    expect(questions[0]).toMatchObject({ id: c.id, required: true });
    expect(questions[2].id).toBe(a.id);
    expect(questions.some((q: any) => q.label === "B")).toBeFalse();

    // other fields stay as they were
    const renamed = await json(await updateType(event.id, created.id, { name: "VIP" }));
    expect(renamed).toMatchObject({ name: "VIP", quota: 10, questions: [{ label: "C2" }, { label: "New" }, { label: "A" }] });
  });

  test("the kind is locked and the quota can't drop below the seats taken once people enrolled", async () => {
    const event = await createEvent();
    const created = await json(await createType(event.id));
    expect((await json(await updateType(event.id, created.id, { kind: "approval" }))).quota).toBeNull();
    expect((await json(await updateType(event.id, created.id, { kind: "first_come" }))).code).toBe("INVALID_QUOTA");
    expect((await updateType(event.id, created.id, { kind: "first_come", quota: 5 })).status).toBe(200);

    await enroll(event.id, created.id, 3);
    await enroll(event.id, created.id, 4, "rejected"); // holds no seats
    expect((await json(await updateType(event.id, created.id, { kind: "approval" }))).code).toBe("KIND_LOCKED");
    expect((await json(await updateType(event.id, created.id, { quota: 2 }))).code).toBe("QUOTA_BELOW_TAKEN");
    expect((await updateType(event.id, created.id, { quota: 3, price: 100 })).status).toBe(200);
  });

  test("a ticket type of another event is not found", async () => {
    const event = await createEvent();
    const other = await createEvent();
    const created = await json(await createType(event.id));
    expect((await updateType(other.id, created.id, { name: "x" })).status).toBe(404);
  });
});

describe("delete", () => {
  test("deletes an unused type; one with enrollments stays, and so does its event", async () => {
    const event = await createEvent();
    const unused = await json(await createType(event.id));
    expect((await request("DELETE", `/${event.id}/ticket-types/${unused.id}`, "owner")).status).toBe(200);

    const used = await json(await createType(event.id));
    await enroll(event.id, used.id, 1);
    const response = await request("DELETE", `/${event.id}/ticket-types/${used.id}`, "owner");
    expect(response.status).toBe(409);
    expect((await json(response)).code).toBe("TICKET_TYPE_IN_USE");

    const eventDelete = await request("DELETE", `/${event.id}`, "owner");
    expect(eventDelete.status).toBe(409);
    expect((await json(eventDelete)).code).toBe("EVENT_HAS_ENROLLMENTS");
  });
});

describe("list", () => {
  test("follows the event's visibility, by id or slug", async () => {
    const event = await createEvent();
    await createType(event.id, { name: "One" });
    await createType(event.id, { name: "Two", kind: "approval" });
    const list = await json(await request("GET", `/${event.slug}/ticket-types`));
    expect(list.map((type: any) => type.name)).toEqual(["One", "Two"]);

    const draft = await createEvent("draft");
    expect((await request("GET", `/${draft.id}/ticket-types`, "guest")).status).toBe(404);
    expect((await request("GET", `/${draft.id}/ticket-types`, "owner")).status).toBe(200);

    const invite = await createEvent("invite");
    expect((await json(await request("GET", `/${invite.id}/ticket-types`, "guest"))).code).toBe("INVITE_ONLY");
    await db.insert(eventInvitations).values({ eventId: invite.id, email: emailOf("guest") });
    expect((await request("GET", `/${invite.id}/ticket-types`, "guest")).status).toBe(200);
  });
});
