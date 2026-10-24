import { and, db, eq, lte, seatHolds, sql, ticketTypes } from "@app/db";
import { activeHold, announceSeats, seatsTaken, SoldOut, type Tx } from "@app/tickets";
import { enrollableEvent, type Viewer } from "../../libs/access";
import { ticketsOwned } from "../../libs/enrollments";
import { HoldExpired, LimitReached, NothingToHold, TicketTypeNotFound } from "../../libs/errors";
import type * as HoldModel from "./model";

/** How long a hold keeps its seats while the account fills in the enroll form; enrolling then holds them for payment. */
export const SEAT_HOLD_MS = 10 * 60_000;

type HoldRow = typeof seatHolds.$inferSelect;
type TicketTypeRow = typeof ticketTypes.$inferSelect;

const toHold = (hold: HoldRow): HoldModel.Hold => ({
  ticketTypeId: hold.ticketTypeId,
  quantity: hold.quantity,
  expiresAt: hold.expiresAt.toISOString(),
  expiresIn: Math.max(0, hold.expiresAt.getTime() - Date.now()),
});

/** Locks the ticket type row, the lock enroll() and quota edits take before counting seats. */
async function lockTicketType(tx: Tx, ticketTypeId: string) {
  const [ticketType] = await tx.select().from(ticketTypes).where(eq(ticketTypes.id, ticketTypeId)).for("update");
  return ticketType;
}

async function runningHold(tx: Tx, ticketTypeId: string, holderId: string) {
  const [hold] = await tx
    .select()
    .from(seatHolds)
    .where(and(eq(seatHolds.ticketTypeId, ticketTypeId), eq(seatHolds.holderId, holderId), activeHold()));
  return hold;
}

/** LimitReached or SoldOut if `holderId` can't hold `quantity` seats of the locked ticket type, its own hold aside. */
async function refuseSeats(tx: Tx, ticketType: TicketTypeRow, holderId: string, quantity: number) {
  if ((await ticketsOwned(tx, ticketType.id, holderId)) + quantity > ticketType.maxPerUser) return new LimitReached();
  if (ticketType.quota !== null && (await seatsTaken(tx, ticketType.id, { holderId })) + quantity > ticketType.quota) {
    return new SoldOut();
  }
  return null;
}

/**
 * Holds seats of a first_come ticket type for `holder` for SEAT_HOLD_MS, so they're theirs while
 * they fill in the enroll form; enroll() takes them over. An account has one hold per ticket type:
 * while it runs, this answers it unchanged (same seats, same deadline), so a reload or another
 * device carries on with it. Holds are checked against the quota and `max_per_user` like enrollments.
 */
export async function startHold(ticketTypeId: string, holder: Viewer, quantity = 1) {
  const open = await enrollableEvent(ticketTypeId, holder);
  if (open instanceof Error) return open;

  const result = await db.transaction(async (tx) => {
    const ticketType = await lockTicketType(tx, ticketTypeId);
    if (!ticketType) return new TicketTypeNotFound();
    if (ticketType.quota === null) return new NothingToHold();
    const running = await runningHold(tx, ticketTypeId, holder.id);
    if (running) return { hold: running, created: false };

    const refused = await refuseSeats(tx, ticketType, holder.id, quantity);
    if (refused) return refused;
    // lapsed holds of this type, the holder's own among them (one row per account)
    await tx.delete(seatHolds).where(and(eq(seatHolds.ticketTypeId, ticketTypeId), lte(seatHolds.expiresAt, sql`now()`)));
    const [hold] = await tx
      .insert(seatHolds)
      .values({
        eventId: ticketType.eventId,
        ticketTypeId,
        holderId: holder.id,
        quantity,
        expiresAt: new Date(Date.now() + SEAT_HOLD_MS),
      })
      .returning();
    return { hold: hold!, created: true };
  });
  if (result instanceof Error) return result;
  if (result.created) announceSeats(result.hold.eventId);
  return toHold(result.hold);
}

/** Changes how many seats `holder`'s running hold has (the enroll form's ticket count); the deadline stays. */
export async function resizeHold(ticketTypeId: string, holder: Viewer, quantity: number) {
  const result = await db.transaction(async (tx) => {
    const ticketType = await lockTicketType(tx, ticketTypeId);
    if (!ticketType) return new TicketTypeNotFound();
    if (ticketType.quota === null) return new NothingToHold();
    const running = await runningHold(tx, ticketTypeId, holder.id);
    if (!running) return new HoldExpired();
    if (quantity === running.quantity) return { hold: running, changed: false };

    const refused = await refuseSeats(tx, ticketType, holder.id, quantity);
    if (refused) return refused;
    const [hold] = await tx.update(seatHolds).set({ quantity }).where(eq(seatHolds.id, running.id)).returning();
    return { hold: hold!, changed: true };
  });
  if (result instanceof Error) return result;
  if (result.changed) announceSeats(result.hold.eventId);
  return toHold(result.hold);
}
