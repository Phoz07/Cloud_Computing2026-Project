import { RedisClient } from "bun";
import { SEATS_CHANNEL } from "@app/tickets";
import type * as AvailabilityModel from "./model";
import { countSeats } from "./service";

// While an event's seats keep changing, it's recounted at most once in this window
const MIN_RECOUNT_MS = 250;
// Watched events are recounted this often anyway, in case an announcement was lost (Redis down)
const RESYNC_MS = 30_000;
// A hold lapses by the database's clock, so its recount waits a little past expires_at
const LAPSE_SLACK_MS = 100;

type Publisher = { publish(topic: string, data: string): unknown };

/** One event that sockets on this process watch. */
type Feed = {
  // the ids of the sockets watching it
  watchers: Set<string>;
  // the counts last published, and as sent
  seats: AvailabilityModel.Seats[] | null;
  message: string | null;
  // settles once the first count is in
  ready: Promise<void>;
  lastCount: number;
  counting: boolean;
  // something changed while counting, so count again
  stale: boolean;
  wait?: Timer;
  lapse?: Timer;
};

const feeds = new Map<string, Feed>();
let server: Publisher | undefined;
let subscriber: RedisClient | undefined;
let resync: Timer | undefined;

/** The Bun pub/sub topic of the sockets watching an event. */
export const seatsTopic = (eventId: string) => `seats:${eventId}`;

/**
 * Starts listening for seat announcements (announceSeats in @app/tickets, from any service).
 * Every process recounts only the events its own sockets watch, so one recount serves all of
 * an event's viewers here instead of each viewer polling. Without Redis it falls back to the resync.
 */
export async function startSeatFeed(publisher: Publisher) {
  server = publisher;
  resync = setInterval(() => {
    for (const eventId of feeds.keys()) recountSoon(eventId);
  }, RESYNC_MS);
  try {
    subscriber = new RedisClient();
    await subscriber.subscribe(SEATS_CHANNEL, (eventId) => recountSoon(eventId));
  } catch (error) {
    console.error(`Seat feed can't hear announcements; watched events resync every ${RESYNC_MS / 1000}s`, error);
  }
}

export function stopSeatFeed() {
  clearInterval(resync);
  subscriber?.close();
  for (const feed of feeds.values()) {
    clearTimeout(feed.wait);
    clearTimeout(feed.lapse);
  }
  feeds.clear();
  server = subscriber = resync = undefined;
}

/**
 * Counts a socket in as watching the event, and resolves to the counts to send it first (null if
 * the first count failed; the next change sends them). Subscribe the socket to seatsTopic() right
 * after, without awaiting in between, so it can't miss a publish.
 */
export async function watchSeats(eventId: string, socketId: string) {
  let feed = feeds.get(eventId);
  if (!feed) {
    feed = {
      watchers: new Set(),
      seats: null,
      message: null,
      ready: Promise.resolve(),
      lastCount: 0,
      counting: false,
      stale: false,
    };
    feeds.set(eventId, feed);
    feed.ready = recount(eventId, feed);
  }
  feed.watchers.add(socketId);
  await feed.ready;
  return feed.seats;
}

/** Counts a socket out; a socket that wasn't watching is ignored. */
export function unwatchSeats(eventId: string, socketId: string) {
  const feed = feeds.get(eventId);
  if (!feed?.watchers.delete(socketId) || feed.watchers.size > 0) return;
  clearTimeout(feed.wait);
  clearTimeout(feed.lapse);
  feeds.delete(eventId);
}

/** Recounts a watched event now, or once MIN_RECOUNT_MS has passed since its last count. */
function recountSoon(eventId: string) {
  const feed = feeds.get(eventId);
  // nobody on this process watches it
  if (!feed) return;
  if (feed.counting || feed.wait) {
    feed.stale = true;
    return;
  }
  const wait = feed.lastCount + MIN_RECOUNT_MS - Date.now();
  if (wait <= 0) {
    void recount(eventId, feed);
    return;
  }
  feed.wait = setTimeout(() => {
    feed.wait = undefined;
    void recount(eventId, feed);
  }, wait);
}

/** Counts the event's seats and publishes them if they changed; schedules a recount for the next lapsing hold. */
async function recount(eventId: string, feed: Feed) {
  feed.counting = true;
  feed.stale = false;
  feed.lastCount = Date.now();
  try {
    const { seats, nextLapse } = await countSeats(eventId);
    // unwatched meanwhile
    if (feeds.get(eventId) !== feed) return;
    const message = JSON.stringify(seats);
    if (message !== feed.message) {
      feed.seats = seats;
      feed.message = message;
      server?.publish(seatsTopic(eventId), message);
    }
    clearTimeout(feed.lapse);
    feed.lapse = nextLapse
      ? setTimeout(() => recountSoon(eventId), Math.max(0, nextLapse.getTime() - Date.now()) + LAPSE_SLACK_MS)
      : undefined;
  } catch (error) {
    console.error("Seat recount failed", error);
  } finally {
    feed.counting = false;
    if (feed.stale) recountSoon(eventId);
  }
}
