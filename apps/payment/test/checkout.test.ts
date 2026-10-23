import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AuthSession, Role } from "@app/auth-guard";
import type { MailMessage } from "@app/mail";
import Stripe from "stripe";

const enqueueMail = mock(async (_message: MailMessage) => {});
mock.module("@app/mail", () => ({ enqueueMail }));

// Stripe stand-in: sessions and refunds are recorded; webhook signing is the real thing.
const SECRET = "whsec_test_secret";
const realStripe = new Stripe("sk_test_placeholder");
const sessionsCreate = mock(async (_params: Stripe.Checkout.SessionCreateParams) => {
  const id = `cs_test_${crypto.randomUUID()}`;
  return { id, url: `https://checkout.stripe.test/${id}` };
});
const refundsCreate = mock(async (_params: Stripe.RefundCreateParams, _options?: unknown) => ({ id: "re_test" }));
mock.module("../src/libs/stripe", () => ({
  stripe: { checkout: { sessions: { create: sessionsCreate } }, refunds: { create: refundsCreate }, webhooks: realStripe.webhooks },
  webhookSecret: SECRET,
}));

// Stand in for the auth service: the cookie header is the name of a seeded user.
const sessions = new Map<string, AuthSession>();
const resolve = async (headers: Headers) => sessions.get(headers.get("cookie") ?? "") ?? null;
const actual = { ...(await import("@app/auth-guard")) };
mock.module("@app/auth-guard", () => ({
  ...actual,
  authGuard: actual.createAuthGuard(resolve, "test"),
  authenticate: actual.createAuthenticator(resolve),
}));

const { payment: app } = await import("../src/app");
const { db, enrollments, eq, eventCategories, events, inArray, payments, tickets, ticketTypes, users } = await import("@app/db");

const runId = crypto.randomUUID().slice(0, 8);
const userIds: Record<string, string> = {};
const eventIds: string[] = [];
let categoryId: string;

const emailOf = (name: string) => `${name}-${runId}@example.com`;
const json = (response: Response): Promise<any> => response.json();

async function seedUser(name: string, role: Role) {
  const [user] = await db.insert(users).values({ name, email: emailOf(name), role }).returning({ id: users.id });
  userIds[name] = user!.id;
  sessions.set(name, {
    user: { id: user!.id, name, email: emailOf(name), image: null, role },
    session: { id: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3_600_000) },
  });
}

const checkout = (enrollmentId: string, as = "buyer") =>
  app.handle(
    new Request("http://localhost/api/payment/checkout", {
      method: "POST",
      headers: { cookie: as, "content-type": "application/json" },
      body: JSON.stringify({ enrollmentId }),
    }),
  );

async function webhook(type: string, session: Record<string, unknown>, secret = SECRET) {
  const payload = JSON.stringify({ id: `evt_${crypto.randomUUID()}`, object: "event", type, data: { object: session } });
  const signature = await realStripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
  return app.handle(
    new Request("http://localhost/api/payment/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      body: payload,
    }),
  );
}

const paid = (sessionId: string) =>
  webhook("checkout.session.completed", { id: sessionId, object: "checkout.session", payment_status: "paid", payment_intent: "pi_test" });

async function ticketType(kind: "first_come" | "approval" = "first_come", quota = 5) {
  const [event] = await db
    .insert(events)
    .values({
      organizerId: userIds.owner!,
      categoryId,
      title: "Gala",
      slug: `gala-${crypto.randomUUID().slice(0, 12)}`,
      venue: "Hall",
      status: "public",
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 2 * 86_400_000),
    })
    .returning({ id: events.id });
  eventIds.push(event!.id);
  const [type] = await db
    .insert(ticketTypes)
    .values({ eventId: event!.id, kind, name: "VIP", price: "300.00", quota: kind === "first_come" ? quota : null, maxPerUser: 5 })
    .returning({ id: ticketTypes.id });
  return { eventId: event!.id, ticketTypeId: type!.id };
}

type EnrollOptions = { status?: "pending" | "awaiting_payment" | "confirmed"; quantity?: number; expiresInMs?: number };

/** An enrollment as apps/registration makes it: a paid one held for 35 minutes by default. */
async function enrollment(type: { eventId: string; ticketTypeId: string }, options: EnrollOptions = {}) {
  const { status = "awaiting_payment", quantity = 2, expiresInMs = 35 * 60_000 } = options;
  const [row] = await db
    .insert(enrollments)
    .values({
      ...type,
      buyerId: userIds.buyer,
      quantity,
      unitPrice: "300.00",
      status,
      expiresAt: status === "awaiting_payment" ? new Date(Date.now() + expiresInMs) : null,
    })
    .returning({ id: enrollments.id });
  await db.insert(tickets).values(
    Array.from({ length: quantity }, (_, i) => ({
      enrollmentId: row!.id,
      code: crypto.randomUUID().slice(0, 10).toUpperCase(),
      firstName: `Guest${i}`,
      lastName: "Tester",
      email: emailOf(`guest${i}`),
    })),
  );
  return row!.id;
}

const statusOf = async (enrollmentId: string) =>
  (await db.select({ status: enrollments.status }).from(enrollments).where(eq(enrollments.id, enrollmentId)))[0]!.status;

const paymentOf = async (enrollmentId: string) =>
  (await db.select().from(payments).where(eq(payments.enrollmentId, enrollmentId)))[0]!;

beforeAll(async () => {
  await seedUser("owner", "organizer");
  await seedUser("buyer", "user");
  await seedUser("other", "user");
  const [category] = await db
    .insert(eventCategories)
    .values({ name: `cat-pay-${runId}`, slug: `cat-pay-${runId}` })
    .returning({ id: eventCategories.id });
  categoryId = category!.id;
});

beforeEach(() => {
  enqueueMail.mockClear();
  sessionsCreate.mockClear();
  refundsCreate.mockClear();
});

afterAll(async () => {
  const ids = (await db.select({ id: enrollments.id }).from(enrollments).where(inArray(enrollments.eventId, eventIds))).map((r) => r.id);
  if (ids.length) await db.delete(payments).where(inArray(payments.enrollmentId, ids));
  await db.delete(enrollments).where(inArray(enrollments.eventId, eventIds));
  await db.delete(events).where(inArray(events.id, eventIds));
  await db.delete(eventCategories).where(eq(eventCategories.id, categoryId));
  await db.delete(users).where(inArray(users.id, Object.values(userIds)));
});

describe("checkout", () => {
  test("only the buyer pays; an open session is reused", async () => {
    const id = await enrollment(await ticketType());
    expect((await checkout(id, "other")).status).toBe(404);

    const first = await json(await checkout(id));
    expect(first.url).toStartWith("https://checkout.stripe.test/");
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    const params = sessionsCreate.mock.calls[0]![0];
    expect(params).toMatchObject({ mode: "payment", client_reference_id: id, customer_email: emailOf("buyer") });
    expect(params.line_items![0]).toMatchObject({ quantity: 2, price_data: { currency: "thb", unit_amount: 30_000 } });
    // Stripe's minimum session length
    expect(params.expires_at! * 1000).toBeGreaterThan(Date.now() + 30 * 60_000);

    expect((await json(await checkout(id))).url).toBe(first.url);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    expect((await paymentOf(id)).amount).toBe("600.00");
  });

  test("refuses enrollments that don't wait for payment", async () => {
    const type = await ticketType("approval");
    expect((await json(await checkout(await enrollment(type, { status: "pending" })))).code).toBe("NOT_PAYABLE");
    expect((await json(await checkout(await enrollment(type, { status: "confirmed" })))).code).toBe("ALREADY_PAID");
    const lapsed = await enrollment(await ticketType(), { expiresInMs: -1000 });
    expect((await json(await checkout(lapsed))).code).toBe("ENROLLMENT_CLOSED");
  });

  test("an approval session ends at the payment deadline, at most 24 hours ahead", async () => {
    const id = await enrollment(await ticketType("approval"), { expiresInMs: 72 * 3_600_000 });
    await checkout(id);
    const expiresAt = sessionsCreate.mock.calls[0]![0].expires_at! * 1000;
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 24 * 3_600_000);
    expect(expiresAt).toBeGreaterThan(Date.now() + 23 * 3_600_000);
  });
});

describe("webhook", () => {
  test("refuses a bad signature", async () => {
    const response = await webhook("checkout.session.completed", { id: "cs_x", payment_status: "paid" }, "whsec_wrong");
    expect(response.status).toBe(400);
  });

  test("a paid session confirms the enrollment and mails its tickets, once", async () => {
    const id = await enrollment(await ticketType());
    await checkout(id);
    const { stripeSessionId } = await paymentOf(id);
    expect((await paid(stripeSessionId)).status).toBe(200);
    expect(await statusOf(id)).toBe("confirmed");
    expect(await paymentOf(id)).toMatchObject({ status: "paid", stripePaymentIntentId: "pi_test" });
    expect(enqueueMail.mock.calls.map(([m]) => m.to).sort()).toEqual([emailOf("guest0"), emailOf("guest1")]);

    enqueueMail.mockClear();
    expect((await paid(stripeSessionId)).status).toBe(200);
    expect(enqueueMail).not.toHaveBeenCalled();
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  test("an unpaid (delayed) completion waits for async_payment_succeeded", async () => {
    const id = await enrollment(await ticketType());
    await checkout(id);
    const { stripeSessionId } = await paymentOf(id);
    await webhook("checkout.session.completed", { id: stripeSessionId, payment_status: "unpaid", payment_intent: "pi_test" });
    expect(await statusOf(id)).toBe("awaiting_payment");
    await webhook("checkout.session.async_payment_succeeded", { id: stripeSessionId, payment_status: "paid", payment_intent: "pi_test" });
    expect(await statusOf(id)).toBe("confirmed");
  });

  test("an expired session ends a seat hold, but not an approval's deadline", async () => {
    const held = await enrollment(await ticketType());
    await checkout(held);
    await webhook("checkout.session.expired", { id: (await paymentOf(held)).stripeSessionId, payment_status: "unpaid" });
    expect(await statusOf(held)).toBe("expired");
    expect((await paymentOf(held)).status).toBe("expired");

    const approved = await enrollment(await ticketType("approval"), { expiresInMs: 72 * 3_600_000 });
    await checkout(approved);
    await webhook("checkout.session.expired", { id: (await paymentOf(approved)).stripeSessionId, payment_status: "unpaid" });
    expect(await statusOf(approved)).toBe("awaiting_payment");
    // the buyer can start over: a third session (held, approved, and this one)
    await checkout(approved);
    expect(sessionsCreate).toHaveBeenCalledTimes(3);
  });

  test("a payment that lands after its hold lapsed and the seats went is refunded", async () => {
    const type = await ticketType("first_come", 2);
    const late = await enrollment(type);
    await checkout(late);
    // the hold lapses and someone else takes both seats
    await db.update(enrollments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(enrollments.id, late));
    await enrollment(type, { status: "confirmed" });

    expect((await paid((await paymentOf(late)).stripeSessionId)).status).toBe(200);
    expect(refundsCreate).toHaveBeenCalledTimes(1);
    expect(refundsCreate.mock.calls[0]![0]).toMatchObject({ payment_intent: "pi_test" });
    expect(await statusOf(late)).toBe("expired");
    expect((await paymentOf(late)).status).toBe("refunded");
    expect(enqueueMail.mock.calls.map(([m]) => m.to)).toEqual([emailOf("buyer")]);
  });

  test("a late payment still confirms when the seats are free", async () => {
    const late = await enrollment(await ticketType("first_come", 2));
    await checkout(late);
    await db.update(enrollments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(enrollments.id, late));
    await paid((await paymentOf(late)).stripeSessionId);
    expect(await statusOf(late)).toBe("confirmed");
    expect(refundsCreate).not.toHaveBeenCalled();
  });
});
