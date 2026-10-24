import { createFiles, Files, FilesError, type Adapter } from "files-sdk";
import { bunS3 } from "files-sdk/bun-s3";
import { contentType } from "files-sdk/content-type";
import { validation, ValidationError } from "files-sdk/validation";
import { FileTooLarge, StorageUnavailable, UnsupportedFile } from "./errors";
import { fileKinds, folderOf, keyPattern, type FileKind } from "./kinds";

// bunS3() builds a Bun.S3Client from the S3_* variables in the root .env, so nothing to configure.
let adapter: Adapter | undefined;
const byKind = new Map<FileKind, Files>();
let plain: Files | undefined;

const currentAdapter = () => (adapter ??= bunS3());

/** Swaps the backend, e.g. for `memory()` from files-sdk/memory in tests. */
export function setStorageAdapter(next: Adapter) {
  adapter = next;
  byKind.clear();
  plain = undefined;
}

// contentType() must run first: it relabels the upload with what the bytes really are,
// so validation() checks the real type instead of the one the browser claimed.
function filesFor(kind: FileKind) {
  let files = byKind.get(kind);
  if (!files) {
    const { types, maxSize } = fileKinds[kind];
    files = createFiles({
      adapter: currentAdapter(),
      plugins: [
        contentType({ onUnknown: "reject" }),
        validation({ maxSize, allowedTypes: [...types], key: keyPattern(kind) }),
      ],
    });
    byKind.set(kind, files);
  }
  return files;
}

const FILES_PATH = "/files";

/** Browser path of a stored key; the Vite proxy (dev) or the CDN (prod) serves `/files/*`. */
export const fileUrl = (key: string) => `${FILES_PATH}/${key}`;

/**
 * The key behind a URL, only when it is a file of this kind and owner. Anything else
 * (a Google avatar, another user's file, a crafted path) is null, so it is never deleted.
 */
export function ownedKey(url: string | null | undefined, kind: FileKind, ownerId: string) {
  const prefix = `${FILES_PATH}/${folderOf(kind, ownerId)}/`;
  if (!url?.startsWith(prefix)) return null;
  const key = url.slice(FILES_PATH.length + 1);
  return keyPattern(kind).test(key) ? key : null;
}

export type StoredFile = { key: string; url: string; contentType: string; size: number };

/** Uploads under a fresh key. Returns an HTTPError instead of throwing, for Elysia handlers. */
export async function storeFile(kind: FileKind, ownerId: string, file: Blob) {
  const key = `${folderOf(kind, ownerId)}/${Bun.randomUUIDv7()}`;
  try {
    const stored = await filesFor(kind).upload(key, file);
    return { key, url: fileUrl(key), contentType: stored.contentType, size: stored.size };
  } catch (error) {
    if (error instanceof ValidationError) {
      if (error.reason === "size") return new FileTooLarge();
      if (error.reason === "type") return new UnsupportedFile();
      // the key rule only fails when a caller passes an owner id that isn't a uuid
      throw error;
    }
    // contentType() rejects bytes it can't identify, or a malformed declared type
    if (error instanceof FilesError && error.code === "Invalid") return new UnsupportedFile();
    console.error(`Failed to store ${key}`, error);
    return new StorageUnavailable();
  }
}

/**
 * Best effort: the database is the source of truth, so a failed delete leaves an orphaned
 * object rather than failing the request that already committed. Logs and never throws.
 */
export async function deleteFile(key: string | null | undefined) {
  if (!key) return;
  try {
    await (plain ??= new Files({ adapter: currentAdapter() })).delete(key);
  } catch (error) {
    if (error instanceof FilesError && error.code === "NotFound") return;
    console.error(`Failed to delete ${key}`, error);
  }
}

/**
 * The bytes of a stored file, e.g. a cover to draw into an OG image. Null when it's missing or
 * storage fails (logged), so a caller can carry on without it. Never throws.
 */
export async function readFile(key: string) {
  try {
    const file = await (plain ??= new Files({ adapter: currentAdapter() })).download(key);
    return await file.arrayBuffer();
  } catch (error) {
    if (!(error instanceof FilesError && error.code === "NotFound")) console.error(`Failed to read ${key}`, error);
    return null;
  }
}
