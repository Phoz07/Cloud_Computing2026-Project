import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { AuthSession, Role } from "@app/auth-guard";
import type { MailMessage } from "@app/mail";

const enqueueMail = mock(async (_message: MailMessage) => {});
mock.module("@app/mail", () => ({ enqueueMail }));

// Stand in for the auth service: the cookie header is the name of a seeded user.
const sessions = new Map<string, AuthSession>();
const resolve = async (headers: Headers) => sessions.get(headers.get("cookie") ?? "") ?? null;
const actual = { ...(await import("@app/auth-guard")) };
mock.module("@app/auth-guard", () => ({
  ...actual,
  authGuard: actual.createAuthGuard(resolve, "test"),
  authenticate: actual.createAuthenticator(resolve),
}));

const { registration: app } = await import("../src/app");
const { SEAT_HOLD_MS } = await import("../src/routes/holds/service");
const { PAYMENT_HOLD_MS } = await import("../src/routes/enrollments/service");
const { seatsTaken } = await import("@app/tickets");
const { and, db, enrollments, eq, eventCategories, events, inArray, seatHolds, ticketTypes, users } = await import("@app/db");

const runId = crypto.randomUUID().slice(0, 8);
const userIds: Record<string, string> = {};
const eventIds: string[] = [];
let categoryId: string;

const emailOf = (name: string) => `${name}-${runId}@example.com`;
const crowd = Array.from({ length: 6 }, (_, index) => `fan${index}`);

async function seedUser(name: string, role: Role) {
  const [user] = await db
    .insert(users)
    .values({ name, email: emailOf(name), role })
    .returning({ id: users.id, email: users.email });
  userIds[name] = user!.id;
  sessions.set(name, {
    user: { id: user!.id, name, email: user!.email, image: null, role },
    session: { id: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3_600_000) },
  });
}

const json = (response: Response): Promise<any> => response.json();

function request(method: string, path: string, as?: string, body?: unknown) {
  const headers: Record<string, string> = as ? { cookie: as } : {};
  if (body !== undefined) headers["content-type"] = "application/json";
  return app.handle(
    new Request(`http://localhost/api/regis${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

async function createEvent({ ended = false } = {}) {
  const now = Date.now();
  const [event] = await db
    .insert(events)
    .values({
      organizerId: userIds.owner!,
      categoryId,
      title: "Festival",
      slug: `festival-${crypto.randomUUID().slice(0, 12)}`,
      venue: "Park",
      status: "public",
      startsAt: new Date(ended ? now - 2 * 86_400_000 : now + 86_400_000),
      endsAt: new Date(ended ? now - 86_400_000 : now + 2 * 86_400_000),
    })
    .returning({ id: events.id });
  eventIds.push(event!.id);
  return event!.id;
}

type TypeOptions = { kind?: "first_come" | "approval"; price?: number; quota?: number; maxPerUser?: number };

async function createType(eventId: string, { kind = "first_come", price = 0, quota = 10, maxPerUser = 5 }: TypeOptions = {}) {
  const [type] = await db
    .insert(ticketTypes)
    .values({
      eventId,
      kind,
      name: `${kind} ticket`,
      price: price.toFixed(2),
      quota: kind === "first_come" ? quota : null,
      maxPerUser,
    })
    .returning({ id: ticketTypes.id });
  return type!.id;
}

const hold = (ticketTypeId: string, as = "buyer", quantity?: number) =>
  request("POST", `/ticket-types/${ticketTypeId}/hold`, as, quantity === undefined ? {} : { quantity });
const resize = (ticketTypeId: string, quantity: number, as = "buyer") =>
  request("PATCH", `/ticket-types/${ticketTypeId}/hold`, as, { quantity });

const attendees = (count: number, as = "buyer") =>
  Array.from({ length: count }, (_, index) => ({
    firstName: `${as}${index}`,
    lastName: "Tester",
    email: emailOf(`${as}${index}`),
    answers: [],
  }));
const enroll = (ticketTypeId: string, count = 1, as = "buyer") =>
  request("POST", "/enrollments", as, { ticketTypeId, attendees: attendees(count, as) });

const availabilityOf = async (eventId: string, ticketTypeId: string, as?: string) =>
  (await json(await request("GET", `/events/${eventId}/availability`, as))).find((a: any) => a.ticketTypeId === ticketTypeId);

const holdRows = (ticketTypeId: string) => db.select().from(seatHolds).where(eq(seatHolds.ticketTypeId, ticketTypeId));

/** Makes `as`'s hold on the ticket type run out now, as if its time had passed. */
const lapse = (ticketTypeId: string, as = "buyer") =>
  db
    .update(seatHolds)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(and(eq(seatHolds.ticketTypeId, ticketTypeId), eq(seatHolds.holderId, userIds[as]!)));

beforeAll(async () => {
  await seedUser("owner", "organizer");
  for (const name of ["buyer", "stranger", ...crowd]) await seedUser(name, "user");
  const [category] = await db
    .insert(eventCategories)
    .values({ name: `cat-hold-${runId}`, slug: `cat-hold-${runId}` })
    .returning({ id: eventCategories.id });
  categoryId = category!.id;
});

afterAll(async () => {
  await db.delete(enrollments).where(inArray(enrollments.eventId, eventIds));
  // seat holds and ticket types go with their events
  await db.delete(events).where(inArray(events.id, eventIds));
  await db.delete(eventCategories).where(eq(eventCategories.id, categoryId));
  await db.delete(users).where(inArray(users.id, Object.values(userIds)));
});

describe("seat holds", () => {
  test("a hold takes a seat for 10 minutes, and asking again (a reload, another device) answers it unchanged", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { quota: 2 });

    const started = await hold(typeId);
    expect(started.status).toBe(200);
    const first = await json(started);
    expect(first).toMatchObject({ ticketTypeId: typeId, quantity: 1 });
    expect(first.expiresIn).toBeGreaterThan(SEAT_HOLD_MS - 5000);
    expect(first.expiresIn).toBeLessThanOrEqual(SEAT_HOLD_MS);

    // a running hold keeps its seats and deadline, whatever the new request asks for
    const again = await json(await hold(typeId, "buyer", 2));
    expect(again).toMatchObject({ quantity: 1, expiresAt: first.expiresAt });
    expect(await holdRows(typeId)).toHaveLength(1);

    expect(await seatsTaken(db, typeId)).toBe(1);
    expect(await availabilityOf(eventId, typeId, "stranger")).toMatchObject({ held: 1, remaining: 1, hold: null, state: "open" });
    expect(await availabilityOf(eventId, typeId, "buyer")).toMatchObject({
      held: 1,
      remaining: 1,
      hold: { quantity: 1, expiresAt: first.expiresAt },
    });
  });

  test("resizing keeps the deadline; held seats are sold out to others but stay open to their holder", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { quota: 2 });
    const first = await json(await hold(typeId));

    const resized = await resize(typeId, 2);
    expect(resized.status).toBe(200);
    expect(await json(resized)).toMatchObject({ quantity: 2, expiresAt: first.expiresAt });
    expect(await availabilityOf(eventId, typeId, "stranger")).toMatchObject({ held: 2, remaining: 0, state: "sold_out" });
    expect(await availabilityOf(eventId, typeId, "buyer")).toMatchObject({ remaining: 0, state: "open" });

    // nobody else gets in, by holding or by enrolling outright
    expect(await json(await hold(typeId, "stranger"))).toMatchObject({ code: "SOLD_OUT" });
    expect((await enroll(typeId, 1, "stranger")).status).toBe(409);
    expect((await resize(typeId, 3)).status).toBe(409);

    expect((await resize(typeId, 1)).status).toBe(200);
    expect(await availabilityOf(eventId, typeId, "stranger")).toMatchObject({ held: 1, remaining: 1, state: "open" });
  });

  test("a lapsed hold frees its seats at once and can't be resized; the holder may start over", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { quota: 1 });
    await hold(typeId);
    expect((await hold(typeId, "stranger")).status).toBe(409);

    await lapse(typeId);
    expect(await availabilityOf(eventId, typeId, "buyer")).toMatchObject({ held: 0, remaining: 1, hold: null });
    expect(await json(await resize(typeId, 1))).toMatchObject({ code: "HOLD_EXPIRED" });

    // the stranger takes the seat; the buyer's lapsed row is cleared on the way
    expect((await hold(typeId, "stranger")).status).toBe(200);
    expect((await holdRows(typeId)).map((row) => row.holderId)).toEqual([userIds.stranger!]);
    expect(await json(await hold(typeId))).toMatchObject({ code: "SOLD_OUT" });

    await lapse(typeId, "stranger");
    const restarted = await hold(typeId);
    expect(restarted.status).toBe(200);
    expect((await json(restarted)).expiresIn).toBeGreaterThan(SEAT_HOLD_MS - 5000);
  });

  test("enrolling takes the hold's seats over: confirmed when free, held for payment when paid", async () => {
    const eventId = await createEvent();
    const free = await createType(eventId, { quota: 2 });
    await hold(free, "buyer", 2);

    const confirmed = await enroll(free, 2);
    expect(confirmed.status).toBe(200);
    expect(await json(confirmed)).toMatchObject({ status: "confirmed", quantity: 2 });
    expect(await holdRows(free)).toHaveLength(0);
    expect(await availabilityOf(eventId, free, "buyer")).toMatchObject({ confirmed: 2, held: 0, remaining: 0, hold: null });

    const paid = await createType(eventId, { price: 300, quota: 1 });
    await hold(paid);
    const awaiting = await json(await enroll(paid));
    expect(awaiting.status).toBe("awaiting_payment");
    expect(Date.parse(awaiting.expiresAt) - Date.now()).toBeGreaterThan(PAYMENT_HOLD_MS - 5000);
    expect(await holdRows(paid)).toHaveLength(0);
    expect(await availabilityOf(eventId, paid, "stranger")).toMatchObject({ reserved: 1, held: 0, remaining: 0, state: "sold_out" });
  });

  test("enrolling after the hold lapsed still works while seats are free", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { quota: 1 });
    await hold(typeId);
    await lapse(typeId);
    expect(await json(await enroll(typeId))).toMatchObject({ status: "confirmed" });
    expect(await holdRows(typeId)).toHaveLength(0);
  });

  test("a hold counts toward max_per_user with the account's tickets", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { maxPerUser: 2 });
    expect((await enroll(typeId)).status).toBe(200);

    expect(await json(await hold(typeId, "buyer", 2))).toMatchObject({ code: "LIMIT_REACHED" });
    expect((await hold(typeId)).status).toBe(200);
    expect(await json(await resize(typeId, 2))).toMatchObject({ code: "LIMIT_REACHED" });
  });

  test("concurrent holds never take more seats than the quota", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { quota: 3 });
    const responses = await Promise.all(crowd.map((name) => hold(typeId, name)));
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 200, 200, 409, 409, 409]);
    expect(await seatsTaken(db, typeId)).toBe(3);
  });

  test("only first_come ticket types of an open event hold seats, for a signed-in account", async () => {
    const eventId = await createEvent();
    const approval = await createType(eventId, { kind: "approval" });
    expect(await json(await hold(approval))).toMatchObject({ code: "NOTHING_TO_HOLD" });

    const ended = await createEvent({ ended: true });
    expect(await json(await hold(await createType(ended)))).toMatchObject({ code: "ENROLLMENT_NOT_OPEN" });

    const typeId = await createType(eventId);
    expect((await request("POST", `/ticket-types/${typeId}/hold`, undefined, {})).status).toBe(401);
    expect(await json(await hold(crypto.randomUUID()))).toMatchObject({ code: "TICKET_TYPE_NOT_FOUND" });
  });
});
