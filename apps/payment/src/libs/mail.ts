import { db, enrollments, eq, events, tickets, ticketTypes, users } from "@app/db";
import { enqueueMail } from "@app/mail";
import { accountLink, formatMailTime } from "@app/tickets";

type RefundRow = { enrollmentId: string; amount: string; percent: number; status: string; initiatedBy: string; note: string | null };

// "฿1,250" or "฿62.50"
const baht = (thb: number) =>
  `฿${thb.toLocaleString("th-TH", { minimumFractionDigits: Number.isInteger(thb) ? 0 : 2, maximumFractionDigits: 2 })}`;

async function orderOf(enrollmentId: string) {
  const [order] = await db
    .select({
      buyerEmail: users.email,
      buyerName: users.name,
      title: events.title,
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
  return order;
}

type Order = NonNullable<Awaited<ReturnType<typeof orderOf>>>;

const orderLine = (order: Order) =>
  `ตั๋ว <strong>${Bun.escapeHTML(order.ticketType)}</strong> × ${order.quantity} ของอีเวนต์ <strong>${Bun.escapeHTML(order.title)}</strong> (${formatMailTime(order.startsAt)})`;

/** A payment that landed after its hold lapsed and its seats went: refunded in full. Never throws. */
export async function mailLateRefund(enrollmentId: string, amount: string) {
  try {
    const order = await orderOf(enrollmentId);
    if (!order?.buyerEmail) return;
    await enqueueMail({
      to: order.buyerEmail,
      subject: `คืนเงินแล้ว: ${order.title}`,
      html:
        `<p>สวัสดีคุณ ${Bun.escapeHTML(order.buyerName ?? "")}</p>` +
        `<p>การชำระเงินสำหรับอีเวนต์ <strong>${Bun.escapeHTML(order.title)}</strong> (${formatMailTime(order.startsAt)}) ` +
        `เข้ามาหลังหมดเวลาจองที่นั่ง และที่นั่งเต็มแล้ว เราจึงคืนเงิน ${baht(Number(amount))} เต็มจำนวน</p>` +
        `<p>เงินจะกลับเข้าช่องทางที่คุณชำระภายในไม่กี่วันทำการ</p>`,
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
    const order = await orderOf(refund.enrollmentId);
    if (!order) return;
    const byOrganizer = refund.initiatedBy === "organizer";
    const total = Number(order.unitPrice) * order.quantity;
    const mails = [];

    if (order.buyerEmail) {
      mails.push(
        enqueueMail({
          to: order.buyerEmail,
          subject: `ยกเลิกคำสั่งซื้อและคืนเงินแล้ว: ${order.title}`,
          html:
            `<p>สวัสดีคุณ ${Bun.escapeHTML(order.buyerName ?? "")}</p>` +
            (byOrganizer
              ? `<p>ผู้จัดงานยกเลิก${orderLine(order)}ของคุณ และคืนเงินเต็มจำนวน</p>` +
                (refund.note ? `<p>ข้อความจากผู้จัดงาน: ${Bun.escapeHTML(refund.note)}</p>` : "")
              : `<p>ยกเลิก${orderLine(order)}ตามคำขอของคุณแล้ว</p>`) +
            `<p>ยอดคืน <strong>${baht(Number(refund.amount))}</strong> (${refund.percent}% ของ ${baht(total)})</p>` +
            (refund.status === "requires_action"
              ? "<p>Stripe จะส่งอีเมลขอเลขบัญชีธนาคารที่คุณใช้ชำระ กรุณาตอบกลับเพื่อรับเงินคืน</p>"
              : "<p>เงินจะกลับเข้าช่องทางที่คุณชำระภายใน 5–10 วันทำการ</p>") +
            `<p><a href="${accountLink(`/tickets/orders/${refund.enrollmentId}`, true)}">ดูรายการ</a></p>`,
        }),
      );
    }

    const attendees = await db
      .select({ email: tickets.email, firstName: tickets.firstName, lastName: tickets.lastName })
      .from(tickets)
      .where(eq(tickets.enrollmentId, refund.enrollmentId));
    const notified = new Set([order.buyerEmail]);
    for (const attendee of attendees) {
      if (notified.has(attendee.email)) continue;
      notified.add(attendee.email);
      mails.push(
        enqueueMail({
          to: attendee.email,
          subject: `ตั๋วของคุณถูกยกเลิก: ${order.title}`,
          html:
            `<p>สวัสดีคุณ ${Bun.escapeHTML(`${attendee.firstName} ${attendee.lastName}`)}</p>` +
            `<p>${orderLine(order)}${order.buyerName ? ` ที่คุณ ${Bun.escapeHTML(order.buyerName)} ซื้อไว้` : ""} ถูกยกเลิกแล้ว ` +
            "ตั๋วและ QR code ใช้เช็กอินไม่ได้อีก</p>",
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
    const order = await orderOf(refund.enrollmentId);
    if (!order?.buyerEmail) return;
    await enqueueMail({
      to: order.buyerEmail,
      subject: `คืนเงินไม่สำเร็จ: ${order.title}`,
      html:
        `<p>สวัสดีคุณ ${Bun.escapeHTML(order.buyerName ?? "")}</p>` +
        `<p>การคืนเงิน ${baht(Number(refund.amount))} สำหรับ${orderLine(order)}ไม่สำเร็จ ` +
        "เพราะธนาคารหรือช่องทางที่คุณชำระไม่รับเงินคืน</p>" +
        "<p>กรุณาติดต่อผู้จัดงานเพื่อรับเงินคืนทางช่องทางอื่น</p>" +
        `<p><a href="${accountLink(`/tickets/orders/${refund.enrollmentId}`, true)}">ดูรายการ</a></p>`,
    });
  } catch (error) {
    console.error("Failed to enqueue refund failure mail", error);
  }
}
