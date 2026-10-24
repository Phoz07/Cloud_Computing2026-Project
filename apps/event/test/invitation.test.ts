import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
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

const { event: app } = await import("../src/app");
const { db, eq, eventCategories, eventInvitations, events, inArray, users } = await import("@app/db");

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

/** A session for someone whose account is created only after they were invited. */
function signInAs(name: string, userId: string) {
  sessions.set(name, {
    user: { id: userId, name, email: emailOf(name), image: null, role: "user" },
    session: { id: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3_600_000) },
  });
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

async function createEvent(as = "owner", status = "invite") {
  const response = await request("POST", "/", as, {
    title: "Private party",
    categoryId,
    venue: "Hall",
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  });
  const body = await json(response);
  eventIds.push(body.id);
  await request("PATCH", `/${body.id}`, as, { status });
  return body as { id: string; slug: string };
}

const invite = async (eventId: string, emails: string[], as = "owner") =>
  request("POST", `/${eventId}/invitations`, as, { emails });

beforeAll(async () => {
  await seedUser("owner", "organizer");
  await seedUser("other", "organizer");
  await seedUser("admin", "admin");
  await seedUser("guest", "user");
  await seedUser("stranger", "user");
  const [category] = await db
    .insert(eventCategories)
    .values({ name: `cat-inv-${runId}`, slug: `cat-inv-${runId}` })
    .returning({ id: eventCategories.id });
  categoryId = category!.id;
});

beforeEach(() => {
  enqueueMail.mockReset();
  enqueueMail.mockImplementation(async () => {});
});

afterAll(async () => {
  await db.delete(events).where(inArray(events.id, eventIds));
  await db.delete(eventCategories).where(eq(eventCategories.id, categoryId));
  await db.delete(users).where(inArray(users.id, userIds));
});

describe("create", () => {
  test("invites accounts and not-yet-registered emails; shows the account when there is one", async () => {
    const event = await createEvent();
    const response = await invite(event.id, [emailOf("guest").toUpperCase(), `nobody-${runId}@example.com`]);
    expect(response.status).toBe(200);
    const { invited, skipped } = await json(response);
    expect(skipped).toEqual([]);
    const byEmail = Object.fromEntries(invited.map((i: any) => [i.email, i]));
    // stored lowercase, matched to the account
    expect(byEmail[emailOf("guest")].user).toMatchObject({ name: "guest", id: userIds[3] });
    expect(byEmail[emailOf("guest")].user).not.toHaveProperty("email");
    expect(byEmail[`nobody-${runId}@example.com`].user).toBeNull();
    expect(invited.every((i: any) => i.status === "unused" && i.usedAt === null)).toBeTrue();
  });

  test("skips emails already invited, and duplicates within one request", async () => {
    const event = await createEvent();
    await invite(event.id, [emailOf("guest")]);
    const { invited, skipped } = await json(
      await invite(event.id, [emailOf("guest"), `new-${runId}@example.com`, `NEW-${runId}@example.com`]),
    );
    expect(invited.map((i: any) => i.email)).toEqual([`new-${runId}@example.com`]);
    expect(skipped).toEqual([emailOf("guest")]);
  });

  test("rejects invalid emails and anyone but the owner or an admin", async () => {
    const event = await createEvent();
    expect((await invite(event.id, ["not-an-email"])).status).toBe(422);
    expect((await invite(event.id, [])).status).toBe(422);
    expect((await invite(event.id, [emailOf("guest")], "other")).status).toBe(403);
    expect((await invite(event.id, [emailOf("guest")], "guest")).status).toBe(403);
    expect((await request("POST", `/${event.id}/invitations`, undefined, { emails: [emailOf("guest")] })).status).toBe(401);
    expect((await invite(event.id, [emailOf("guest")], "admin")).status).toBe(200);
  });
});

describe("list", () => {
  test("filters by status and search, with counts for every status", async () => {
    const event = await createEvent();
    await invite(event.id, [emailOf("guest"), `a-${runId}@example.com`, `b-${runId}@example.com`]);
    await db
      .update(eventInvitations)
      .set({ usedAt: new Date() })
      .where(eq(eventInvitations.email, `a-${runId}@example.com`));

    const all = await json(await request("GET", `/${event.id}/invitations`, "owner"));
    expect(all.total).toBe(3);
    expect(all.counts).toEqual({ used: 1, unused: 2 });

    const used = await json(await request("GET", `/${event.id}/invitations?status=used`, "owner"));
    expect(used.items.map((i: any) => i.email)).toEqual([`a-${runId}@example.com`]);
    expect(used.items[0].status).toBe("used");
    expect(used.total).toBe(1);

    // search matches the account name too
    const byName = await json(await request("GET", `/${event.id}/invitations?q=guest`, "owner"));
    expect(byName.items.map((i: any) => i.email)).toEqual([emailOf("guest")]);

    expect((await request("GET", `/${event.id}/invitations`, "other")).status).toBe(403);
  });
});

describe("update and delete", () => {
  test("fixes the email of an unused invitation; refuses a duplicate", async () => {
    const event = await createEvent();
    const { invited } = await json(await invite(event.id, [`typo-${runId}@example.com`, emailOf("stranger")]));
    const typo = invited.find((i: any) => i.email.startsWith("typo"));

    const fixed = await json(
      await request("PATCH", `/${event.id}/invitations/${typo.id}`, "owner", { email: emailOf("guest") }),
    );
    expect(fixed.email).toBe(emailOf("guest"));
    expect(fixed.user.name).toBe("guest");

    const duplicate = await request("PATCH", `/${event.id}/invitations/${typo.id}`, "owner", {
      email: emailOf("stranger"),
    });
    expect(duplicate.status).toBe(409);
    expect((await json(duplicate)).code).toBe("INVITATION_EXISTS");
  });

  test("a used invitation is locked; an unused one can be revoked", async () => {
    const event = await createEvent();
    const { invited } = await json(await invite(event.id, [`used-${runId}@example.com`, `unused-${runId}@example.com`]));
    const [used, unused] = [invited.find((i: any) => i.email.startsWith("used")), invited.find((i: any) => i.email.startsWith("unused"))];
    await db.update(eventInvitations).set({ usedAt: new Date() }).where(eq(eventInvitations.id, used.id));

    expect((await json(await request("DELETE", `/${event.id}/invitations/${used.id}`, "owner"))).code).toBe("INVITATION_USED");
    expect(
      (await json(await request("PATCH", `/${event.id}/invitations/${used.id}`, "owner", { email: `x-${runId}@example.com` }))).code,
    ).toBe("INVITATION_USED");
    expect((await request("DELETE", `/${event.id}/invitations/${unused.id}`, "owner")).status).toBe(200);
    expect((await request("DELETE", `/${event.id}/invitations/${unused.id}`, "owner")).status).toBe(404);
  });

  test("an invitation of another event is not found through this one", async () => {
    const mine = await createEvent();
    const theirs = await createEvent("other");
    const { invited } = await json(await invite(theirs.id, [emailOf("guest")], "other"));
    expect((await request("DELETE", `/${mine.id}/invitations/${invited[0].id}`, "owner")).status).toBe(404);
  });
});

const mailedTo = () => enqueueMail.mock.calls.map(([message]) => message.to).sort();

/** Switching to invite mails in the background; wait until `count` mails are queued. */
async function waitForMails(count: number) {
  for (let i = 0; i < 100 && enqueueMail.mock.calls.length < count; i++) await Bun.sleep(10);
}

describe("mail", () => {
  test("an invite-only event emails each new invitee once, by name when they have an account", async () => {
    const event = await createEvent();
    const { invited } = await json(await invite(event.id, [emailOf("guest"), `fresh-${runId}@example.com`]));
    expect(invited.every((i: any) => i.notifiedAt !== null)).toBeTrue();
    expect(mailedTo()).toEqual([emailOf("guest"), `fresh-${runId}@example.com`].sort());

    const byTo = Object.fromEntries(enqueueMail.mock.calls.map(([message]) => [message.to, message]));
    expect(byTo[emailOf("guest")]!.subject).toContain("Private party");
    expect(byTo[emailOf("guest")]!.html).toContain("คุณ guest");
    expect(byTo[emailOf("guest")]!.html).toContain(`/events/${event.slug}"`);
    // no account yet: the link signs them up first, then lands on the event
    expect(byTo[`fresh-${runId}@example.com`]!.html).toContain(`/register?redirect=${encodeURIComponent(`/events/${event.slug}`)}`);

    // inviting again (skipped) mails no one
    await invite(event.id, [emailOf("guest")]);
    expect(enqueueMail).toHaveBeenCalledTimes(2);
  });

  test("a draft's invitees are mailed once it switches to invite-only, and not again after", async () => {
    const event = await createEvent("owner", "draft");
    const { invited } = await json(await invite(event.id, [emailOf("guest"), emailOf("stranger")]));
    expect(invited.every((i: any) => i.notifiedAt === null)).toBeTrue();
    expect(enqueueMail).not.toHaveBeenCalled();

    await request("PATCH", `/${event.id}`, "owner", { status: "invite" });
    await waitForMails(2);
    expect(mailedTo()).toEqual([emailOf("guest"), emailOf("stranger")].sort());

    await request("PATCH", `/${event.id}`, "owner", { status: "draft" });
    await request("PATCH", `/${event.id}`, "owner", { status: "invite" });
    await Bun.sleep(50);
    expect(enqueueMail).toHaveBeenCalledTimes(2);
  });

  test("changing the email mails the new address", async () => {
    const event = await createEvent();
    const { invited } = await json(await invite(event.id, [`old-${runId}@example.com`]));
    enqueueMail.mockClear();
    const updated = await json(
      await request("PATCH", `/${event.id}/invitations/${invited[0].id}`, "owner", { email: `new-mail-${runId}@example.com` }),
    );
    expect(updated.notifiedAt).not.toBeNull();
    expect(mailedTo()).toEqual([`new-mail-${runId}@example.com`]);
  });

  test("a failed enqueue doesn't fail the invite, and is retried on the next one", async () => {
    const event = await createEvent();
    enqueueMail.mockImplementationOnce(async () => {
      throw new Error("queue down");
    });
    const first = await invite(event.id, [`retry-${runId}@example.com`]);
    expect(first.status).toBe(200);
    expect((await json(first)).invited[0].notifiedAt).toBeNull();

    await invite(event.id, [`later-${runId}@example.com`]);
    expect(mailedTo()).toEqual([`later-${runId}@example.com`, `retry-${runId}@example.com`, `retry-${runId}@example.com`].sort());
    const list = await json(await request("GET", `/${event.id}/invitations`, "owner"));
    expect(list.items.every((i: any) => i.notifiedAt !== null)).toBeTrue();
  });
});

describe("access", () => {
  test("an invited account opens the invite-only event; others are told it's invite-only", async () => {
    const event = await createEvent();
    await invite(event.id, [emailOf("guest")]);
    expect((await json(await request("GET", `/${event.slug}`, "guest"))).id).toBe(event.id);
    expect((await json(await request("GET", `/${event.slug}`, "stranger"))).code).toBe("INVITE_ONLY");
    expect((await json(await request("GET", `/${event.slug}`))).code).toBe("INVITE_ONLY");
  });

  test("someone invited before registering gets in once they sign up with that email", async () => {
    const event = await createEvent();
    await invite(event.id, [emailOf("latecomer")]);
    const listed = await json(await request("GET", `/${event.id}/invitations`, "owner"));
    expect(listed.items[0].user).toBeNull();

    const userId = await seedUser("latecomer", "user");
    signInAs("latecomer", userId);
    expect((await request("GET", `/${event.slug}`, "latecomer")).status).toBe(200);
    const after = await json(await request("GET", `/${event.id}/invitations`, "owner"));
    expect(after.items[0].user.id).toBe(userId);
  });

  test("invitations only open invite-only events, not drafts", async () => {
    const event = await createEvent("owner", "draft");
    await invite(event.id, [emailOf("guest")]);
    expect((await request("GET", `/${event.slug}`, "guest")).status).toBe(404);
  });

  test("a suspended event's invitations stay readable but frozen for its organizer", async () => {
    const event = await createEvent();
    await request("PATCH", `/${event.id}`, "admin", { status: "suspended" });
    expect((await request("GET", `/${event.id}/invitations`, "owner")).status).toBe(200);
    expect((await json(await invite(event.id, [emailOf("guest")]))).code).toBe("EVENT_SUSPENDED");
    expect((await request("GET", `/${event.slug}`, "guest")).status).toBe(404);
  });
});
