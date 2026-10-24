import { db, eq, payments, refunds } from "@app/db";
import { refundSatang, type Tx } from "@app/tickets";
import Stripe from "stripe";
import { RefundRejected, RefundUnavailable } from "./errors";
import { stripe } from "./stripe";

type PaymentRow = typeof payments.$inferSelect;
type RefundStatus = (typeof refunds.$inferSelect)["status"];

const refundStatuses: RefundStatus[] = ["pending", "requires_action", "succeeded", "failed", "canceled"];

/** Stripe's refund status as ours; a missing or unknown one reads as still in progress. */
export const toRefundStatus = (status: string | null): RefundStatus =>
  refundStatuses.find((known) => known === status) ?? "pending";

type RefundInput = {
  // of the payment's amount
  percent: number;
  initiatedBy: "buyer" | "organizer" | "system";
  requestedBy?: string;
  note?: string;
};

/**
 * A refund an earlier attempt made for this payment but didn't record (it crashed, or its
 * transaction rolled back after Stripe said yes). One that failed or was cancelled gave nothing back.
 */
async function unrecordedRefund(paymentIntentId: string, paymentId: string) {
  const { data } = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
  return data.find(
    (refund) => refund.metadata?.paymentId === paymentId && refund.status !== "failed" && refund.status !== "canceled",
  );
}

/** Whether the payment was made by card (the charge's payment method; a wallet such as Apple Pay counts). */
async function paidByCard(paymentIntentId: string) {
  const { data } = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });
  return data[0]?.payment_method_details?.type === "card";
}

/**
 * Refunds `percent` of a paid payment, records it and marks the payment refunded.
 *
 * Only a card payment is refunded through Stripe. For anything else (e.g. PromptPay) Stripe would
 * have to email the buyer for a bank account, so we make the refund by hand instead: it's recorded
 * as requires_action with no Stripe refund, and the caller's mail tells the buyer how to claim it.
 *
 * A payment is refunded once: a retry after a crash records the refund Stripe already made rather
 * than asking for a second. No fixed idempotency key, since Stripe would replay a refusal under it
 * for 24 hours, even once its cause (e.g. account settings) is fixed. Stripe refusing it is
 * RefundRejected, Stripe being unreachable RefundUnavailable; either way nothing is written.
 */
export async function issueRefund(executor: typeof db | Tx, payment: PaymentRow, input: RefundInput) {
  const paymentIntentId = payment.stripePaymentIntentId;
  if (!paymentIntentId) throw new Error(`Paid session without a payment intent: ${payment.stripeSessionId}`);
  const amount = refundSatang(Number(payment.amount), input.percent);
  // null: made by hand
  let refund: Stripe.Refund | null = null;
  try {
    if (await paidByCard(paymentIntentId)) {
      refund =
        (await unrecordedRefund(paymentIntentId, payment.id)) ??
        (await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount,
          metadata: { enrollmentId: payment.enrollmentId, paymentId: payment.id, initiatedBy: input.initiatedBy },
        }));
    }
  } catch (error) {
    console.error("Failed to create a Stripe refund", error);
    return error instanceof Stripe.errors.StripeInvalidRequestError ? new RefundRejected() : new RefundUnavailable();
  }

  const [row] = await executor
    .insert(refunds)
    .values({
      enrollmentId: payment.enrollmentId,
      paymentId: payment.id,
      amount: (amount / 100).toFixed(2),
      percent: input.percent,
      // by hand: waiting for the buyer to send their bank account
      status: refund ? toRefundStatus(refund.status) : "requires_action",
      initiatedBy: input.initiatedBy,
      requestedBy: input.requestedBy,
      note: input.note,
      stripeRefundId: refund?.id ?? null,
    })
    // a retried step that recorded it already (unrecordedRefund found the same refund, or both by hand)
    .onConflictDoNothing({ target: refunds.paymentId })
    .returning();
  await executor.update(payments).set({ status: "refunded" }).where(eq(payments.id, payment.id));
  return row ?? (await executor.select().from(refunds).where(eq(refunds.paymentId, payment.id)))[0]!;
}
