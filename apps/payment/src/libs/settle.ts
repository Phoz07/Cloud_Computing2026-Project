import { and, db, enrollments, eq, ne, payments, ticketTypes } from "@app/db";
import { announceSeats, confirmEnrollment, sendTicketMails } from "@app/tickets";
import type Stripe from "stripe";
import { mailSystemRefund } from "./mail";
import { issueRefund } from "./refund";

type Session = Stripe.Checkout.Session;
type PaymentRow = typeof payments.$inferSelect;

// How a Checkout session's end reaches its enrollment, whether the webhook or the buyer's
// "check payment" brings the news. Each step first claims its payment row with a conditional
// update (pending → paid / expired), so news delivered twice is a no-op.

const paymentIntentOf = (session: Session) =>
  typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

/** A paid session confirms its enrollment. Anything that throws after the claim releases it, so a retry runs the whole step again. */
export async function settlePaid(session: Session) {
  const [payment] = await db
    .update(payments)
    .set({ status: "paid", paidAt: new Date(), stripePaymentIntentId: paymentIntentOf(session) })
    .where(and(eq(payments.stripeSessionId, session.id), eq(payments.status, "pending")))
    .returning();
  // not ours, or already handled
  if (!payment) return;

  try {
    // checkout reuses open sessions, so a second paid one is unexpected; it's refunded all the same
    const [other] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.enrollmentId, payment.enrollmentId), eq(payments.status, "paid"), ne(payments.id, payment.id)))
      .limit(1);
    if (other) return await refund(payment, "duplicate");

    const result = await confirmEnrollment(payment.enrollmentId);
    // the hold ran out and its seats (or invitation) went to someone else meanwhile
    if (result instanceof Error) return await refund(payment, "unavailable");
    if (!result.alreadyConfirmed) await sendTicketMails(payment.enrollmentId);
  } catch (error) {
    await db.update(payments).set({ status: "pending", paidAt: null }).where(eq(payments.id, payment.id));
    throw error;
  }
}

/**
 * Refunds a payment in full and closes its enrollment unless another payment confirmed it, then
 * tells the buyer (one made by hand needs them to get in touch).
 * issueRefund records a refund Stripe already made, so Stripe's retries (and ours) refund once.
 */
async function refund(payment: PaymentRow, reason: "duplicate" | "unavailable") {
  const refunded = await issueRefund(db, payment, { percent: 100, initiatedBy: "system", note: reason });
  // the catch in settlePaid releases the payment, so a retry tries again
  if (refunded instanceof Error) throw refunded;

  if (reason === "unavailable") {
    // only a lapsed hold; a rejected or cancelled order keeps its status
    await db
      .update(enrollments)
      .set({ status: "expired" })
      .where(and(eq(enrollments.id, payment.enrollmentId), eq(enrollments.status, "awaiting_payment")));
  }
  await mailSystemRefund(refunded);
}

/**
 * A session that ended without payment. A first_come or invite enrollment held its seats for
 * this session, so the hold is over; an approval one keeps its deadline (the buyer may try again).
 */
export async function settleUnpaid(session: Session) {
  const [payment] = await db
    .update(payments)
    .set({ status: "expired" })
    .where(and(eq(payments.stripeSessionId, session.id), eq(payments.status, "pending")))
    .returning({ enrollmentId: payments.enrollmentId });
  if (!payment) return;

  const [row] = await db
    .select({ kind: ticketTypes.kind })
    .from(enrollments)
    .innerJoin(ticketTypes, eq(ticketTypes.id, enrollments.ticketTypeId))
    .where(eq(enrollments.id, payment.enrollmentId));
  if (row?.kind === "approval") return;
  const [expired] = await db
    .update(enrollments)
    .set({ status: "expired" })
    .where(and(eq(enrollments.id, payment.enrollmentId), eq(enrollments.status, "awaiting_payment")))
    .returning({ eventId: enrollments.eventId });
  // the session can end before the hold does, freeing the seats early
  if (expired) announceSeats(expired.eventId);
}
