import { and, asc, count, db, eq, eventAssets, events } from "@app/db";
import { deleteFile, fileUrl, storeFile } from "@app/storage";
import { HTTPError } from "elysia";
import { EventNotFound } from "../../libs/errors";
import type * as MediaModel from "./model";

export const MAX_ASSETS_PER_EVENT = 20;

export class AssetNotFound extends HTTPError.id("ASSET_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบรูปนี้";
}

export class AssetLimitReached extends HTTPError.id("ASSET_LIMIT_REACHED", 409) {
  override readonly detail = `อัปโหลดรูปได้สูงสุด ${MAX_ASSETS_PER_EVENT} รูปต่ออีเวนต์`;
}

type AssetRow = typeof eventAssets.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const toAsset = (row: AssetRow): MediaModel.Asset => ({
  id: row.id,
  url: fileUrl(row.key),
  contentType: row.contentType,
  size: row.size,
  createdAt: row.createdAt.toISOString(),
});

// Locks the event row, so concurrent writes to the same event's media run one after another.
const lockEvent = (tx: Tx, eventId: string) =>
  tx.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for("update");

// The DB keeps the key; the old object is deleted only after the new key is committed.
async function replaceCover(eventId: string, key: string | null) {
  const previous = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ key: events.coverImageKey })
      .from(events)
      .where(eq(events.id, eventId))
      .for("update");
    await tx.update(events).set({ coverImageKey: key }).where(eq(events.id, eventId));
    return row?.key;
  });
  await deleteFile(previous);
}

export async function setCover(eventId: string, file: File) {
  const stored = await storeFile("eventCover", eventId, file);
  if (stored instanceof Error) return stored;
  await replaceCover(eventId, stored.key);
  return { coverUrl: stored.url };
}

export async function removeCover(eventId: string) {
  await replaceCover(eventId, null);
  return { coverUrl: null };
}

export async function listAssets(eventId: string) {
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId));
  if (!event) return new EventNotFound();
  const rows = await db
    .select()
    .from(eventAssets)
    .where(eq(eventAssets.eventId, eventId))
    .orderBy(asc(eventAssets.createdAt));
  return rows.map(toAsset);
}

async function assetCount(tx: Tx | typeof db, eventId: string) {
  const [row] = await tx
    .select({ total: count() })
    .from(eventAssets)
    .where(eq(eventAssets.eventId, eventId));
  return row?.total ?? 0;
}

export async function addAsset(eventId: string, file: File) {
  // cheap check first, so a full gallery never uploads anything
  if ((await assetCount(db, eventId)) >= MAX_ASSETS_PER_EVENT) return new AssetLimitReached();

  const stored = await storeFile("eventAsset", eventId, file);
  if (stored instanceof Error) return stored;

  try {
    const row = await db.transaction(async (tx) => {
      // re-check under the lock: two uploads may have passed the first check together
      await lockEvent(tx, eventId);
      if ((await assetCount(tx, eventId)) >= MAX_ASSETS_PER_EVENT) return null;
      const [inserted] = await tx
        .insert(eventAssets)
        .values({ eventId, key: stored.key, contentType: stored.contentType, size: stored.size })
        .returning();
      return inserted ?? null;
    });
    if (!row) {
      await deleteFile(stored.key);
      return new AssetLimitReached();
    }
    return toAsset(row);
  } catch (error) {
    await deleteFile(stored.key);
    throw error;
  }
}

export async function removeAsset(eventId: string, assetId: string) {
  const [row] = await db
    .delete(eventAssets)
    .where(and(eq(eventAssets.id, assetId), eq(eventAssets.eventId, eventId)))
    .returning();
  if (!row) return new AssetNotFound();
  await deleteFile(row.key);
  return toAsset(row);
}
