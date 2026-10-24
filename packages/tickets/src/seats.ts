import { redis } from "bun";

/** The Redis channel seat changes are announced on; each message is an event id. */
export const SEATS_CHANNEL = "seats:changed";

/**
 * Tells the registration service's live availability feed that an event's seat counts changed,
 * so it recounts and pushes them to the event page. Call it once the change has committed.
 * Fire and forget: it never throws or waits on Redis, and a lost announcement is caught by the
 * feed's periodic resync.
 */
export function announceSeats(eventId: string) {
  redis.publish(SEATS_CHANNEL, eventId).catch((error) => console.error("Seat announcement failed", error));
}
