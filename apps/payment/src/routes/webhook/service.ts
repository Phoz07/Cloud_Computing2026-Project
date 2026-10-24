import { and, db, eq, notInArray, refunds } from "@app/db";
import type Stripe from "stripe";
import { mailRefundFailed } from "../../libs/mail";
import { toRefundStatus } from "../../libs/refund";
import { settlePaid, settleUnpaid } from "../../libs/settle";

/**
 * Handles the Checkout events this service cares about (libs/settle.ts claims each payment once,
 * so a redelivered event is a no-op, and one that throws is run again by Stripe's retry).
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
