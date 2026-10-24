import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { Files } from "files-sdk";
import { bunS3 } from "files-sdk/bun-s3";
import {
  deleteFile,
  FileTooLarge,
  ownedKey,
  readFile,
  setStorageAdapter,
  storeFile,
  UnsupportedFile,
  type StoredFile,
} from "../src";
import { useMemoryStorage } from "../src/testing";

// 1x1 transparent PNG
const png = Uint8Array.fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
);
const userId = crypto.randomUUID();

let store: Files;

beforeEach(() => {
  store = useMemoryStorage();
});

const stored = (result: Awaited<ReturnType<typeof storeFile>>) => {
  if (result instanceof Error) throw result;
  return result as StoredFile;
};

describe("storeFile", () => {
  test("stores an image under the owner's folder with the type its bytes have", async () => {
    // the browser claims JPEG, the bytes are PNG
    const file = stored(await storeFile("avatar", userId, new File([png], "me.jpg", { type: "image/jpeg" })));

    expect(file.key).toStartWith(`public/users/${userId}/avatar/`);
    expect(file.url).toBe(`/files/${file.key}`);
    expect(file.contentType).toBe("image/png");
    expect((await store.head(file.key)).contentType).toBe("image/png");
  });

  test("rejects bytes that are not an image", async () => {
    const text = new File(["hello"], "notes.png", { type: "image/png" });
    expect(await storeFile("avatar", userId, text)).toBeInstanceOf(UnsupportedFile);
  });

  test("rejects HTML disguised as an image", async () => {
    const html = new File(["<!doctype html><script>alert(1)</script>"], "x.png", { type: "image/png" });
    expect(await storeFile("eventAsset", crypto.randomUUID(), html)).toBeInstanceOf(UnsupportedFile);
  });

  test("rejects a recognized type outside the allowlist", async () => {
    const pdf = new File(["%PDF-1.7\n"], "doc.pdf", { type: "application/pdf" });
    expect(await storeFile("eventCover", crypto.randomUUID(), pdf)).toBeInstanceOf(UnsupportedFile);
  });

  test("rejects a file over the kind's limit", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(png);
    expect(await storeFile("avatar", userId, new File([big], "big.png"))).toBeInstanceOf(FileTooLarge);
  });

  test("refuses an owner id that is not a uuid", async () => {
    await expect(storeFile("avatar", "../admin", new File([png], "a.png"))).rejects.toThrow();
  });
});

describe("ownedKey", () => {
  const key = `public/users/${userId}/avatar/${crypto.randomUUID()}`;

  test("returns the key of the owner's own file", () => {
    expect(ownedKey(`/files/${key}`, "avatar", userId)).toBe(key);
  });

  test("ignores URLs that are not this owner's file", () => {
    expect(ownedKey(`/files/${key}`, "avatar", crypto.randomUUID())).toBeNull();
    expect(ownedKey(`/files/${key}`, "eventCover", userId)).toBeNull();
    expect(ownedKey("https://lh3.googleusercontent.com/a/photo", "avatar", userId)).toBeNull();
    expect(ownedKey(`/files/public/users/${userId}/avatar/../../x`, "avatar", userId)).toBeNull();
    expect(ownedKey(null, "avatar", userId)).toBeNull();
  });
});

describe("deleteFile", () => {
  test("removes the object", async () => {
    const file = stored(await storeFile("avatar", userId, new File([png], "a.png")));
    await deleteFile(file.key);
    expect(await store.exists(file.key)).toBeFalse();
  });

  test("does not throw for a missing key", async () => {
    await expect(deleteFile(`public/users/${userId}/avatar/${crypto.randomUUID()}`)).resolves.toBeUndefined();
  });
});

describe("readFile", () => {
  test("returns the stored bytes", async () => {
    const file = stored(await storeFile("avatar", userId, new File([png], "a.png")));
    expect(new Uint8Array((await readFile(file.key))!)).toEqual(png);
  });

  test("is null for a missing key", async () => {
    expect(await readFile(`public/users/${userId}/avatar/${crypto.randomUUID()}`)).toBeNull();
  });
});

// Needs `bun run infra:up`: the same calls against MinIO through Bun's S3 client.
describe("MinIO", () => {
  const created: string[] = [];
  afterAll(() => Promise.all(created.map(deleteFile)));

  test("stores, labels and deletes a real object", async () => {
    const adapter = bunS3();
    setStorageAdapter(adapter);
    const minio = new Files({ adapter });

    const file = stored(await storeFile("avatar", userId, new File([png], "me.jpg", { type: "image/jpeg" })));
    created.push(file.key);
    expect((await minio.head(file.key)).contentType).toBe("image/png");

    await deleteFile(file.key);
    expect(await minio.exists(file.key)).toBeFalse();
  });
});
