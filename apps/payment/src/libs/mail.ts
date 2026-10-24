import { db, enrollments, eq, events, tickets, ticketTypes, users } from "@app/db";
import { enqueueMail, type MailOrder } from "@app/mail";
import { accountLink } from "@app/tickets";

type RefundRow = {
  enrollmentId: string;
  amount: string;
  percent: number;
  status: string;
  initiatedBy: string;
  note: string | null;
  // null: made by hand (libs/refund.ts), so the mail asks the buyer for their bank account
  stripeRefundId: string | null;
};

async function orderOf(enrollmentId: string) {
  const [row] = await db
    .select({
      buyerEmail: users.email,
      buyerName: users.name,
      title: events.title,
      venue: events.venue,
      startsAt: events.startsAt,
      ticketType: ticketTypes.name,
      quantity: enrollments.quantity,
      unitPrice: enrollments.unitPrice,
    })
    .from(enrollments)
    .innerJoin(events, eq(events.id, enrollments.eventId))
    .innerJoin(ticketTypes, eq(ticketTypes.id, enrollments.ticketTypeId))
    .leftJoin(users, eq(users.id, enrollments.buyerId))
    .where(eq(enrollments.id, enrollmentId));
  if (!row) return undefined;
  const order: MailOrder = {
    event: { title: row.title, venue: row.venue, startsAt: row.startsAt.toISOString() },
    ticketType: row.ticketType,
    quantity: row.quantity,
  };
  return { buyerEmail: row.buyerEmail, buyerName: row.buyerName, total: Number(row.unitPrice) * row.quantity, order };
}

const ordersPage = (enrollmentId: string) => accountLink(`/tickets/orders/${enrollmentId}`, true);

/**
 * A payment the system refunded in full, for the reason in the refund's note: it landed after its
 * hold lapsed and the seats went (unavailable), or it paid for the order a second time (duplicate).
 * Never throws.
 */
export async function mailSystemRefund(refund: RefundRow) {
  try {
    const found = await orderOf(refund.enrollmentId);
    if (!found?.buyerEmail) return;
    await enqueueMail({
      to: found.buyerEmail,
      template: "refund-system",
      props: {
        name: found.buyerName,
        reason: refund.note === "duplicate" ? "duplicate" : "unavailable",
        order: found.order,
        amount: Number(refund.amount),
        manual: refund.stripeRefundId === null,
        orderNumber: refund.enrollmentId,
      },
    });
  } catch (error) {
    console.error("Failed to enqueue refund mail", error);
  }
}

/**
 * Tells the buyer their order was cancelled and what comes back, and every other attendee that
 * their ticket no longer works. Never throws: the refund is already made.
 */
export async function mailCancellation(refund: RefundRow) {
  try {
    const found = await orderOf(refund.enrollmentId);
    if (!found) return;
    const mails = [];

    if (found.buyerEmail) {
      mails.push(
        enqueueMail({
          to: found.buyerEmail,
          template: "order-cancelled",
          props: {
            name: found.buyerName,
            byOrganizer: refund.initiatedBy === "organizer",
            note: refund.note,
            order: found.order,
            amount: Number(refund.amount),
            percent: refund.percent,
            total: found.total,
            manual: refund.stripeRefundId === null,
            orderNumber: refund.enrollmentId,
            url: ordersPage(refund.enrollmentId),
          },
        }),
      );
    }

    const attendees = await db
      .select({ email: tickets.email, firstName: tickets.firstName, lastName: tickets.lastName })
      .from(tickets)
      .where(eq(tickets.enrollmentId, refund.enrollmentId));
    const notified = new Set([found.buyerEmail]);
    for (const attendee of attendees) {
      if (notified.has(attendee.email)) continue;
      notified.add(attendee.email);
      mails.push(
        enqueueMail({
          to: attendee.email,
          template: "ticket-cancelled",
          props: { name: `${attendee.firstName} ${attendee.lastName}`, buyerName: found.buyerName, order: found.order },
        }),
      );
    }
    await Promise.all(mails.map((mail) => mail.catch((error) => console.error("Failed to enqueue cancellation mail", error))));
  } catch (error) {
    console.error("Failed to send cancellation mail", error);
  }
}

/** Stripe couldn't return the money (it's back in the Stripe balance). Never throws. */
export async function mailRefundFailed(refund: RefundRow) {
  try {
    const found = await orderOf(refund.enrollmentId);
    if (!found?.buyerEmail) return;
    await enqueueMail({
      to: found.buyerEmail,
      template: "refund-failed",
      props: {
        name: found.buyerName,
        order: found.order,
        amount: Number(refund.amount),
        url: ordersPage(refund.enrollmentId),
      },
    });
  } catch (error) {
    console.error("Failed to enqueue refund failure mail", error);
  }
}
