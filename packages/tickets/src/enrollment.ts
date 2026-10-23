import { and, db, enrollments, eq, eventInvitations, gt, inArray, ne, or, sql, ticketTypes } from "@app/db";
import { EnrollmentClosed, EnrollmentNotFound, SoldOut } from "./errors";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

type EnrollmentRow = typeof enrollments.$inferSelect;

/**
 * An enrollment that holds its tickets: confirmed, waiting for the organizer, or a payment hold
 * that hasn't run out. A lapsed hold stops counting right away, so its seats free up without a job;
 * the payment service flips its status to `expired` later.
 */
export const activeEnrollment = () =>
  or(
    inArray(enrollments.status, ["confirmed", "pending"]),
    and(eq(enrollments.status, "awaiting_payment"), gt(enrollments.expiresAt, sql`now()`)),
  );

/** `awaiting_payment` past its hold reads as `expired`, whether or not the webhook has said so yet. */
export const effectiveStatus = (enrollment: Pick<EnrollmentRow, "status" | "expiresAt">) =>
  enrollment.status === "awaiting_payment" && enrollment.expiresAt && enrollment.expiresAt <= new Date()
    ? "expired"
    : enrollment.status;

/**
 * Tickets the active enrollments of a ticket type hold. Writers that check it against the quota
 * lock the ticket type row first (`SELECT … FOR UPDATE`), so two enrollments can't both take the last seat.
 */
export async function seatsTaken(executor: Executor, ticketTypeId: string, exceptEnrollmentId?: string) {
  const [row] = await executor
    .select({ total: sql<number>`coalesce(sum(${enrollments.quantity}), 0)`.mapWith(Number) })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.ticketTypeId, ticketTypeId),
        activeEnrollment(),
        exceptEnrollmentId ? ne(enrollments.id, exceptEnrollmentId) : undefined,
      ),
    );
  return row?.total ?? 0;
}

/** Whether another active enrollment already uses the invitation (it allows one). */
export async function invitationTaken(executor: Executor, invitationId: string, exceptEnrollmentId?: string) {
  const [row] = await executor
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.invitationId, invitationId),
        activeEnrollment(),
        exceptEnrollmentId ? ne(enrollments.id, exceptEnrollmentId) : undefined,
      ),
    )
    .limit(1);
  return !!row;
}

/** Marks an enrollment confirmed and uses up its invitation. Run it in the transaction that locked the enrollment. */
export async function markConfirmed(tx: Tx, enrollment: Pick<EnrollmentRow, "id" | "invitationId">) {
  const now = new Date();
  await tx
    .update(enrollments)
    .set({ status: "confirmed", confirmedAt: now, expiresAt: null })
    .where(eq(enrollments.id, enrollment.id));
  if (enrollment.invitationId) {
    await tx.update(eventInvitations).set({ usedAt: now }).where(eq(eventInvitations.id, enrollment.invitationId));
  }
}

/**
 * Confirms a pending (approved) or paid enrollment. A first_come or invite enrollment whose hold
 * ran out no longer owns its seats or invitation, so it's confirmed only if they're still free;
 * otherwise `SoldOut` (the payment service then refunds). Approval tickets have no seats to protect.
 * `alreadyConfirmed` makes a repeated call (e.g. a webhook delivered twice) a no-op.
 */
export async function confirmEnrollment(enrollmentId: string) {
  return db.transaction(async (tx) => {
    const [enrollment] = await tx.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).for("update");
    if (!enrollment) return new EnrollmentNotFound();
    if (enrollment.status === "confirmed") return { alreadyConfirmed: true };
    if (enrollment.status === "rejected") return new EnrollmentClosed();

    // the same lock the registration service takes before counting seats
    const [ticketType] = await tx
      .select({ kind: ticketTypes.kind, quota: ticketTypes.quota })
      .from(ticketTypes)
      .where(eq(ticketTypes.id, enrollment.ticketTypeId))
      .for("update");
    const lapsed = effectiveStatus(enrollment) === "expired";
    if (lapsed && ticketType?.kind !== "approval") {
      if (ticketType?.quota != null) {
        const taken = await seatsTaken(tx, enrollment.ticketTypeId, enrollment.id);
        if (taken + enrollment.quantity > ticketType.quota) return new SoldOut();
      }
      if (enrollment.invitationId && (await invitationTaken(tx, enrollment.invitationId, enrollment.id))) {
        return new SoldOut();
      }
    }
    await markConfirmed(tx, enrollment);
    return { alreadyConfirmed: false };
  });
}
