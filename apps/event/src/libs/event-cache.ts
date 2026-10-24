import { redis } from "bun";
import { db, eq, events } from "@app/db";
import type * as EventModel from "../routes/events/model";

// Every write refreshes or forgets its entry, so the TTL only bounds how long a rare race (a read
// that caches a copy fetched just before a write) can serve it
const TTL_SECONDS = 300;
// What a deleted event's id holds for a while, so a read that raced the delete can't cache it again
const GONE = "gone";

const idKey = (id: string) => `event:id:${id}`;
const slugKey = (slug: string) => `event:slug:${slug}`;

// Replaces the cached copy, unless the event was deleted meanwhile (an update racing a delete)
const REPLACE_UNLESS_GONE = `
if redis.call('GET', KEYS[1]) == ARGV[3] then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 1`;

/**
 * The cached detail of an event, by id or by slug (which points at the id). "gone" when the id
 * was deleted lately; null on a miss, and when Redis fails, so the caller reads the database.
 */
export async function readCachedEvent(idOrSlug: string, byId: boolean): Promise<EventModel.EventDetail | "gone" | null> {
  try {
    const id = byId ? idOrSlug : await redis.get(slugKey(idOrSlug));
    if (!id) return null;
    const raw = await redis.get(idKey(id));
    // by slug, the database decides: the slug may belong to a new event by now
    if (raw === GONE) return byId ? GONE : null;
    if (!raw) return null;
    const event = JSON.parse(raw) as EventModel.EventDetail;
    // a slug the event no longer has, cached by a read that raced the rename
    return byId || event.slug === idOrSlug ? event : null;
  } catch (error) {
    console.error("Event cache read failed", error);
    return null;
  }
}

/**
 * Caches an event its reader just fetched from the database. It only fills a gap (NX), so a copy
 * fetched before a concurrent write can't replace the copy the writer stored.
 */
export async function cacheEvent(event: EventModel.EventDetail) {
  try {
    await Promise.all([
      redis.set(idKey(event.id), JSON.stringify(event), "EX", String(TTL_SECONDS), "NX"),
      redis.set(slugKey(event.slug), event.id, "EX", String(TTL_SECONDS), "NX"),
    ]);
  } catch (error) {
    console.error("Event cache write failed", error);
  }
}

/**
 * Stores the event as it is right after a write, replacing what was cached, so the next read
 * already sees the change. A renamed event's old slug stops pointing at it.
 */
export async function refreshCachedEvent(event: EventModel.EventDetail, previousSlug?: string) {
  try {
    await Promise.all([
      redis.send("EVAL", [REPLACE_UNLESS_GONE, "1", idKey(event.id), JSON.stringify(event), String(TTL_SECONDS), GONE]),
      redis.set(slugKey(event.slug), event.id, "EX", String(TTL_SECONDS)),
      previousSlug && previousSlug !== event.slug ? redis.del(slugKey(previousSlug)) : undefined,
    ]);
  } catch (error) {
    console.error("Event cache refresh failed", error);
  }
}

/** Forgets a deleted event, and keeps its id from being cached again for a while. */
export async function forgetDeletedEvent(id: string, slug: string) {
  try {
    await Promise.all([redis.set(idKey(id), GONE, "EX", String(TTL_SECONDS)), redis.del(slugKey(slug))]);
  } catch (error) {
    console.error("Event cache delete failed", error);
  }
}

/** Forgets the events of a category whose name or slug changed (their cached copies embed it). */
export async function forgetCategoryEvents(categoryId: string) {
  const rows = await db.select({ id: events.id }).from(events).where(eq(events.categoryId, categoryId));
  if (rows.length === 0) return;
  try {
    await redis.del(...rows.map((row) => idKey(row.id)));
  } catch (error) {
    console.error("Event cache delete failed", error);
  }
}
