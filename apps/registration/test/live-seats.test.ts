import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { redis } from "bun";
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
const { announceSeats, SEATS_CHANNEL } = await import("@app/tickets");
const { db, enrollments, eq, eventCategories, events, inArray, seatHolds, ticketTypes, users } = await import("@app/db");

const runId = crypto.randomUUID().slice(0, 8);
const userIds: Record<string, string> = {};
const eventIds: string[] = [];
let categoryId: string;
let port: number;

const emailOf = (name: string) => `${name}-${runId}@example.com`;

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

async function createEvent(status: "draft" | "public" | "invite" = "public") {
  const now = Date.now();
  const [event] = await db
    .insert(events)
    .values({
      organizerId: userIds.owner!,
      categoryId,
      title: "Concert",
      slug: `concert-${crypto.randomUUID().slice(0, 12)}`,
      venue: "Hall",
      status,
      startsAt: new Date(now + 86_400_000),
      endsAt: new Date(now + 2 * 86_400_000),
    })
    .returning({ id: events.id });
  eventIds.push(event!.id);
  return event!.id;
}

async function createType(eventId: string, { price = 0, quota = 10 } = {}) {
  const [type] = await db
    .insert(ticketTypes)
    .values({ eventId, kind: "first_come", name: "Standing", price: price.toFixed(2), quota, maxPerUser: 10 })
    .returning({ id: ticketTypes.id });
  return type!.id;
}

const enroll = (ticketTypeId: string, as = "buyer") =>
  app.handle(
    new Request("http://localhost/api/regis/enrollments", {
      method: "POST",
      headers: { cookie: as, "content-type": "application/json" },
      body: JSON.stringify({ ticketTypeId, attendees: [{ firstName: as, lastName: "Tester", email: emailOf(as), answers: [] }] }),
    }),
  );

const hold = (ticketTypeId: string, as = "buyer") =>
  app.handle(
    new Request(`http://localhost/api/regis/ticket-types/${ticketTypeId}/hold`, {
      method: "POST",
      headers: { cookie: as, "content-type": "application/json" },
      body: "{}",
    }),
  );

type Seats = {
  ticketTypeId: string;
  confirmed: number;
  reserved: number;
  pending: number;
  held: number;
  remaining: number | null;
};

/** A socket on the live feed that keeps every message it gets. */
function watch(eventId: string, as?: string) {
  const socket = new WebSocket(`ws://localhost:${port}/api/regis/events/${eventId}/availability/live`, {
    headers: as ? { cookie: as } : {},
  });
  const messages: Seats[][] = [];
  const listeners = new Set<() => void>();
  socket.addEventListener("message", (event) => {
    messages.push(JSON.parse(String(event.data)));
    for (const listener of listeners) listener();
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) =>
    socket.addEventListener("close", (event) => resolve({ code: event.code, reason: event.reason })),
  );

  /** The first message, received or still to come, whose seats for `ticketTypeId` match. */
  function until(ticketTypeId: string, expected: Partial<Seats>, timeout = 3000) {
    const matches = (message: Seats[]) => {
      const seat = message.find((candidate) => candidate.ticketTypeId === ticketTypeId);
      return !!seat && Object.entries(expected).every(([key, value]) => seat[key as keyof Seats] === value);
    };
    return new Promise<Seats[]>((resolve, reject) => {
      const check = () => {
        const found = messages.find(matches);
        if (!found) return false;
        listeners.delete(check);
        clearTimeout(timer);
        resolve(found);
        return true;
      };
      const timer = setTimeout(() => {
        listeners.delete(check);
        reject(new Error(`No message with ${JSON.stringify(expected)}; got ${JSON.stringify(messages)}`));
      }, timeout);
      if (!check()) listeners.add(check);
    });
  }

  return { messages, closed, until, close: () => socket.close() };
}

const subscribers = async () => {
  const reply = (await redis.send("PUBSUB", ["NUMSUB", SEATS_CHANNEL])) as [string, number];
  return Number(reply[1]);
};

beforeAll(async () => {
  for (const name of ["owner"]) await seedUser(name, "organizer");
  for (const name of ["buyer", "stranger"]) await seedUser(name, "user");
  const [category] = await db
    .insert(eventCategories)
    .values({ name: `cat-live-${runId}`, slug: `cat-live-${runId}` })
    .returning({ id: eventCategories.id });
  categoryId = category!.id;

  // a dev server may be subscribed too, so wait for ours to add one
  const before = await subscribers();
  app.listen(0);
  port = app.server!.port!;
  for (let tries = 0; (await subscribers()) <= before; tries++) {
    if (tries > 50) throw new Error("The seat feed never subscribed to Redis");
    await Bun.sleep(20);
  }
});

afterAll(async () => {
  await app.stop(true);
  await db.delete(enrollments).where(inArray(enrollments.eventId, eventIds));
  await db.delete(events).where(inArray(events.id, eventIds));
  await db.delete(eventCategories).where(eq(eventCategories.id, categoryId));
  await db.delete(users).where(inArray(users.id, Object.values(userIds)));
});

describe("live seats", () => {
  test("a viewer gets the seats on connect, then fresh ones whenever an enrollment takes some", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { quota: 3 });
    const live = watch(eventId);
    await live.until(typeId, { confirmed: 0, remaining: 3 });

    expect((await enroll(typeId)).status).toBe(200);
    await live.until(typeId, { confirmed: 1, remaining: 2 });
    live.close();
  });

  test("a burst of enrollments is counted together, and ends on the right numbers", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { quota: 5 });
    const live = watch(eventId);
    await live.until(typeId, { remaining: 5 });

    const responses = await Promise.all(Array.from({ length: 8 }, () => enroll(typeId)));
    expect(responses.filter((response) => response.status === 200)).toHaveLength(5);
    await live.until(typeId, { confirmed: 5, remaining: 0 });
    // the first message plus fewer recounts than there were enrollments
    expect(live.messages.length).toBeLessThan(1 + 8);
    live.close();
  });

  test("a payment hold gives its seats back when it lapses, with nothing written", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { price: 300, quota: 2 });
    const live = watch(eventId);
    await live.until(typeId, { remaining: 2 });

    const enrollment = (await (await enroll(typeId)).json()) as { id: string };
    await live.until(typeId, { reserved: 1, remaining: 1 });

    // the hold now runs out in a moment; announcing it makes the feed schedule that
    await db.update(enrollments).set({ expiresAt: new Date(Date.now() + 300) }).where(eq(enrollments.id, enrollment.id));
    announceSeats(eventId);
    await live.until(typeId, { reserved: 0, remaining: 2 });
    live.close();
  });

  test("a seat hold shows as held, and its seats come back when it lapses or move to the enrollment", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { price: 300, quota: 2 });
    const live = watch(eventId);
    await live.until(typeId, { remaining: 2 });

    expect((await hold(typeId)).status).toBe(200);
    await live.until(typeId, { held: 1, remaining: 1 });
    // enrolling takes the hold's seat over for the payment
    expect((await enroll(typeId)).status).toBe(200);
    await live.until(typeId, { held: 0, reserved: 1, remaining: 1 });

    expect((await hold(typeId, "stranger")).status).toBe(200);
    await live.until(typeId, { held: 1, remaining: 0 });
    await db.update(seatHolds).set({ expiresAt: new Date(Date.now() + 300) }).where(eq(seatHolds.ticketTypeId, typeId));
    announceSeats(eventId);
    await live.until(typeId, { held: 0, remaining: 1 });
    live.close();
  });

  test("other services' announcements reach the socket (a quota edit in apps/event)", async () => {
    const eventId = await createEvent();
    const typeId = await createType(eventId, { quota: 4 });
    const live = watch(eventId);
    await live.until(typeId, { remaining: 4 });

    await db.update(ticketTypes).set({ quota: 7 }).where(eq(ticketTypes.id, typeId));
    announceSeats(eventId);
    await live.until(typeId, { remaining: 7 });
    live.close();
  });

  test("whoever can't open the event is closed with the GET's status; its organizer may watch a draft", async () => {
    const draft = await createEvent("draft");
    const draftType = await createType(draft);
    expect(await watch(draft, "stranger").closed).toEqual({ code: 4404, reason: "EVENT_NOT_FOUND" });

    const owner = watch(draft, "owner");
    await owner.until(draftType, { remaining: 10 });
    owner.close();

    const invite = await createEvent("invite");
    await createType(invite);
    expect(await watch(invite).closed).toEqual({ code: 4403, reason: "INVITE_ONLY" });
  });
});
