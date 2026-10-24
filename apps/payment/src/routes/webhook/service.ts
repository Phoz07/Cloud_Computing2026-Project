import { and, db, enrollments, eq, ne, notInArray, payments, refunds, ticketTypes } from "@app/db";
import { confirmEnrollment, sendTicketMails } from "@app/tickets";
import type Stripe from "stripe";
import { mailLateRefund, mailRefundFailed } from "../../libs/mail";
import { issueRefund, toRefundStatus } from "../../libs/refund";

type Session = Stripe.Checkout.Session;
type PaymentRow = typeof payments.$inferSelect;

/**
 * Handles the Checkout events this service cares about. Each one first claims its payment row
 * with a conditional update (pending → paid / expired), so a redelivered event is a no-op.
 * Anything that throws after the claim releases it, so Stripe's retry runs the whole step again.
 * Refund events update the refund they're about.
 */
export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      // a delayed method (e.g. a bank transfer) completes unpaid; async_payment_succeeded follows
      if (event.data.object.payment_status === "paid") await settlePaid(event.data.object);
      return;
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      await settleUnpaid(event.data.object);
      return;
    case "refund.updated":
    case "refund.failed":
      await settleRefund(event.data.object);
      return;
  }
}

const paymentIntentOf = (session: Session) =>
  typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

async function settlePaid(session: Session) {
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
 * Refunds a payment in full and closes its enrollment unless another payment confirmed it.
 * issueRefund's idempotency key makes Stripe's retries (and ours) refund once.
 */
async function refund(payment: PaymentRow, reason: "duplicate" | "unavailable") {
  const refunded = await issueRefund(db, payment, { percent: 100, initiatedBy: "system", note: reason });
  // the catch in settlePaid releases the payment, so Stripe's retry tries again
  if (refunded instanceof Error) throw refunded;
  if (reason === "duplicate") return;

  // only a lapsed hold; a rejected or cancelled order keeps its status
  await db
    .update(enrollments)
    .set({ status: "expired" })
    .where(and(eq(enrollments.id, payment.enrollmentId), eq(enrollments.status, "awaiting_payment")));
  await mailLateRefund(payment.enrollmentId, payment.amount);
}

/**
 * A refund's new status (e.g. PromptPay's requires_action → pending → succeeded, or a card refund
 * that fails days later). failed and canceled are final, so an older event delivered late can't
 * undo them; the buyer hears about a failure once.
 */
async function settleRefund(stripeRefund: Stripe.Refund) {
  const [updated] = await db
    .update(refunds)
    .set({ status: toRefundStatus(stripeRefund.status), failureReason: stripeRefund.failure_reason ?? null })
    .where(and(eq(refunds.stripeRefundId, stripeRefund.id), notInArray(refunds.status, ["failed", "canceled"])))
    .returning();
  if (updated) {
    if (updated.status === "failed") await mailRefundFailed(updated);
    return;
  }
  // ours (it carries our metadata) but not recorded: the request that made it hasn't committed
  // yet, so throw and let Stripe deliver it again. Refunds made in the Stripe Dashboard are ignored.
  if (stripeRefund.metadata?.paymentId) {
    const [known] = await db.select({ id: refunds.id }).from(refunds).where(eq(refunds.stripeRefundId, stripeRefund.id));
    if (!known) throw new Error(`Refund ${stripeRefund.id} isn't recorded yet`);
  }
}

/**
 * A session that ended without payment. A first_come or invite enrollment held its seats for
 * this session, so the hold is over; an approval one keeps its deadline (the buyer may try again).
 */
async function settleUnpaid(session: Session) {
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
  await db
    .update(enrollments)
    .set({ status: "expired" })
    .where(and(eq(enrollments.id, payment.enrollmentId), eq(enrollments.status, "awaiting_payment")));
}
