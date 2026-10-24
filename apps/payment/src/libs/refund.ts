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
 * Refunds `percent` of a paid payment through Stripe, records it and marks the payment refunded.
 * The idempotency key allows one refund per payment, so a retry after a crash (ours or Stripe's)
 * gets the same refund back rather than a second one. Stripe refusing it is RefundRejected, Stripe
 * being unreachable RefundUnavailable; either way nothing is written.
 */
export async function issueRefund(executor: typeof db | Tx, payment: PaymentRow, input: RefundInput) {
  if (!payment.stripePaymentIntentId) throw new Error(`Paid session without a payment intent: ${payment.stripeSessionId}`);
  const amount = refundSatang(Number(payment.amount), input.percent);
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: payment.stripePaymentIntentId,
        amount,
        metadata: { enrollmentId: payment.enrollmentId, paymentId: payment.id, initiatedBy: input.initiatedBy },
      },
      { idempotencyKey: `refund-${payment.id}` },
    );
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
      status: toRefundStatus(refund.status),
      initiatedBy: input.initiatedBy,
      requestedBy: input.requestedBy,
      note: input.note,
      stripeRefundId: refund.id,
    })
    // a retried step that recorded it already (the idempotency key gave the same refund back)
    .onConflictDoNothing({ target: refunds.paymentId })
    .returning();
  await executor.update(payments).set({ status: "refunded" }).where(eq(payments.id, payment.id));
  return row ?? (await executor.select().from(refunds).where(eq(refunds.paymentId, payment.id)))[0]!;
}
