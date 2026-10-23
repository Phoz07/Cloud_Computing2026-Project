import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

// Keep test mail off the real queue (the worker may send through Gmail).
mock.module("@app/mail", () => ({ enqueueMail: mock(async () => {}) }));

const { authentication } = await import("../src/app");
const { db, eq, events, inArray, users } = await import("@app/db");

// Needs `bun run infra:up`: avatars are written to the MinIO bucket.
const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:5173";
const runId = crypto.randomUUID().slice(0, 8);
const password = "password1234";
const createdEmails: string[] = [];
const createdUserIds: string[] = [];
const createdEventIds: string[] = [];

// 1x1 transparent PNG
const png = Uint8Array.fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
);
const pngFile = () => new File([png], "me.png", { type: "image/png" });

type Account = { id: string; email: string; cookie: string };

function call(path: string, cookie: string, init: { method?: string; body?: unknown } = {}) {
  return authentication.handle(
    new Request(`http://localhost/api/auth${path}`, {
      method: init.method ?? "GET",
      headers: { cookie, origin, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

function upload(cookie: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return authentication.handle(
    new Request("http://localhost/api/auth/me/avatar", {
      method: "PUT",
      headers: { cookie, origin },
      body: form,
    }),
  );
}

async function signUp(name: string): Promise<Account> {
  const email = `${name}-${runId}@example.com`;
  createdEmails.push(email);
  const response = await call("/sign-up/email", "", {
    method: "POST",
    body: { name, email, password },
  });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0]!)
    .find((value) => value.includes("session_token="))!;
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  createdUserIds.push(user!.id);
  return { id: user!.id, email, cookie };
}

// response bodies are asserted field by field, so untyped is fine here
const body = (response: Response): Promise<any> => response.json();

const imageOf = async (userId: string) =>
  (await db.select({ image: users.image }).from(users).where(eq(users.id, userId)))[0]?.image;

const keyOf = (image: string) => image.replace(/^\/files\//, "");
const stored = (image: string) => Bun.s3.exists(keyOf(image));

let member: Account;

beforeAll(async () => {
  member = await signUp("avatar");
});

afterAll(async () => {
  // everything under the test users' folders, including images a test overwrote in the DB
  for (const id of createdUserIds) {
    const { contents = [] } = await Bun.s3.list({ prefix: `public/users/${id}/` });
    await Promise.all(contents.map(({ key }) => Bun.s3.delete(key)));
  }
  if (createdEventIds.length) await db.delete(events).where(inArray(events.id, createdEventIds));
  await db.delete(users).where(inArray(users.email, createdEmails));
});

describe("PUT /me/avatar", () => {
  let first: string;

  test("requires a session", async () => {
    expect((await upload("", pngFile())).status).toBe(401);
  });

  test("stores the image under the user's folder and sets users.image", async () => {
    const response = await upload(member.cookie, pngFile());
    expect(response.status).toBe(200);
    first = (await body(response)).image;

    expect(first).toStartWith(`/files/public/users/${member.id}/avatar/`);
    expect(await imageOf(member.id)).toBe(first);
    expect(await stored(first)).toBeTrue();
  });

  test("replacing the image deletes the previous object", async () => {
    const response = await upload(member.cookie, pngFile());
    const second = (await body(response)).image;

    expect(second).not.toBe(first);
    expect(await stored(second)).toBeTrue();
    expect(await stored(first)).toBeFalse();
  });

  test("rejects a file that is not an image, whatever its name says", async () => {
    const before = await imageOf(member.id);
    const response = await upload(member.cookie, new File(["hello"], "me.png", { type: "image/png" }));

    expect(response.status).toBe(415);
    expect((await body(response)).code).toBe("UNSUPPORTED_FILE");
    expect(await imageOf(member.id)).toBe(before);
  });

  test("never deletes a file the user does not own", async () => {
    const other = await signUp("avatar-other");
    const theirs = (await body(await upload(other.cookie, pngFile()))).image;

    // Better Auth's update-user lets anyone point their image at any path
    await db.update(users).set({ image: theirs }).where(eq(users.id, member.id));
    expect((await upload(member.cookie, pngFile())).status).toBe(200);

    expect(await stored(theirs)).toBeTrue();
  });
});

describe("DELETE /me/avatar", () => {
  test("clears users.image and deletes the object", async () => {
    const image = (await body(await upload(member.cookie, pngFile()))).image;

    const response = await call("/me/avatar", member.cookie, { method: "DELETE" });
    expect(await body(response)).toEqual({ image: null });
    expect(await imageOf(member.id)).toBeNull();
    expect(await stored(image)).toBeFalse();
  });
});

describe("deleting an account", () => {
  test("deletes the user's avatar", async () => {
    const leaving = await signUp("avatar-leaving");
    const image = (await body(await upload(leaving.cookie, pngFile()))).image;

    const response = await call("/delete-user", leaving.cookie, { method: "POST", body: { password } });
    expect(response.status).toBe(200);
    expect(await stored(image)).toBeFalse();
  });

  test("is refused while the user organizes events, before anything is removed", async () => {
    const organizer = await signUp("avatar-organizer");
    const admin = await signUp("avatar-admin");
    await db.update(users).set({ role: "admin" }).where(eq(users.id, admin.id));
    const [event] = await db
      .insert(events)
      .values({ organizerId: organizer.id, title: "Test", startsAt: new Date(), endsAt: new Date() })
      .returning({ id: events.id });
    createdEventIds.push(event!.id);

    const self = await call("/delete-user", organizer.cookie, { method: "POST", body: { password } });
    expect(self.status).toBe(403);
    expect((await body(self)).code).toBe("ORGANIZER_HAS_EVENTS");

    const byAdmin = await call("/admin/remove-user", admin.cookie, {
      method: "POST",
      body: { userId: organizer.id },
    });
    expect(byAdmin.status).toBe(403);
    expect((await body(byAdmin)).code).toBe("ORGANIZER_HAS_EVENTS");

    // the session and password account survived, so the organizer can still sign in
    expect((await call("/get-session", organizer.cookie).then(body))?.user.id).toBe(organizer.id);
    const signIn = await call("/sign-in/email", "", {
      method: "POST",
      body: { email: organizer.email, password },
    });
    expect(signIn.status).toBe(200);
  });
});
