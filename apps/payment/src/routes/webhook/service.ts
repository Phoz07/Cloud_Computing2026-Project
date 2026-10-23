import { and, db, enrollments, eq, events, ne, payments, ticketTypes, users } from "@app/db";
import { enqueueMail } from "@app/mail";
import { confirmEnrollment, formatMailTime, sendTicketMails } from "@app/tickets";
import type Stripe from "stripe";
import { stripe } from "../../libs/stripe";

type Session = Stripe.Checkout.Session;
type PaymentRow = typeof payments.$inferSelect;

/**
 * Handles the Checkout events this service cares about. Each one first claims its payment row
 * with a conditional update (pending → paid / expired), so a redelivered event is a no-op.
 * Anything that throws after the claim releases it, so Stripe's retry runs the whole step again.
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
 * The idempotency key makes Stripe's retries (and ours) refund once.
 */
async function refund(payment: PaymentRow, reason: "duplicate" | "unavailable") {
  if (!payment.stripePaymentIntentId) throw new Error(`Paid session without a payment intent: ${payment.stripeSessionId}`);
  await stripe.refunds.create(
    { payment_intent: payment.stripePaymentIntentId, metadata: { enrollmentId: payment.enrollmentId, reason } },
    { idempotencyKey: `refund-${payment.id}` },
  );
  await db.update(payments).set({ status: "refunded" }).where(eq(payments.id, payment.id));
  if (reason === "duplicate") return;

  await db
    .update(enrollments)
    .set({ status: "expired" })
    .where(and(eq(enrollments.id, payment.enrollmentId), ne(enrollments.status, "confirmed")));
  await mailRefund(payment).catch((error) => console.error("Failed to enqueue refund mail", error));
}

async function mailRefund(payment: PaymentRow) {
  const [order] = await db
    .select({ email: users.email, name: users.name, title: events.title, startsAt: events.startsAt })
    .from(enrollments)
    .innerJoin(events, eq(events.id, enrollments.eventId))
    .innerJoin(users, eq(users.id, enrollments.buyerId))
    .where(eq(enrollments.id, payment.enrollmentId));
  if (!order) return;
  await enqueueMail({
    to: order.email,
    subject: `คืนเงินแล้ว: ${order.title}`,
    html:
      `<p>สวัสดีคุณ ${Bun.escapeHTML(order.name)}</p>` +
      `<p>การชำระเงินสำหรับอีเวนต์ <strong>${Bun.escapeHTML(order.title)}</strong> (${formatMailTime(order.startsAt)}) ` +
      `เข้ามาหลังหมดเวลาจองที่นั่ง และที่นั่งเต็มแล้ว เราจึงคืนเงิน ฿${Number(payment.amount).toLocaleString("th-TH")} เต็มจำนวน</p>` +
      `<p>เงินจะกลับเข้าช่องทางที่คุณชำระภายในไม่กี่วันทำการ</p>`,
  });
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
