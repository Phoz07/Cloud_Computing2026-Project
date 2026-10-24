import type { MailTemplates } from "@app/mail";
import { EventDetails, Greeting, Paragraph } from "./_components/blocks";
import { baht } from "./_components/format";
import { MailLayout } from "./_components/layout";
import { RefundOutcome } from "./_components/refund-claim";

type Props = MailTemplates["refund-system"];

export const subject = ({ manual, order }: Props) => `${manual ? "วิธีรับเงินคืน" : "คืนเงินแล้ว"}: ${order.event.title}`;

/** A payment the system refunded in full: a second payment for the order, or one that came after the seats went. */
export default function RefundSystemEmail({ name, reason, order, amount, manual, orderNumber }: Props) {
  const duplicate = reason === "duplicate";
  return (
    <MailLayout
      preview={`คืนเงิน ${baht(amount)} เต็มจำนวน`}
      heading={duplicate ? "คืนเงินที่ชำระซ้ำ" : "ที่นั่งเต็มก่อนชำระเงินเสร็จ"}
    >
      <Greeting name={name} />
      {duplicate ? (
        <Paragraph>
          คุณชำระเงินสำหรับคำสั่งซื้อนี้ซ้ำ คำสั่งซื้อยังใช้ได้ตามปกติ เราจึงคืนเงินที่ชำระซ้ำ <strong>{baht(amount)}</strong> เต็มจำนวน
        </Paragraph>
      ) : (
        <Paragraph>
          การชำระเงินของคุณเข้ามาหลังหมดเวลาจองที่นั่ง และที่นั่งเต็มแล้ว เราจึงคืนเงิน <strong>{baht(amount)}</strong> เต็มจำนวน
        </Paragraph>
      )}
      <EventDetails
        event={order.event}
        ticketType={order.ticketType}
        quantity={order.quantity}
        extra={[["ยอดคืน", baht(amount)]]}
      />
      <RefundOutcome manual={manual} orderNumber={orderNumber} />
    </MailLayout>
  );
}

RefundSystemEmail.PreviewProps = {
  name: "สมชาย ใจดี",
  reason: "unavailable",
  order: {
    event: { title: "Bangkok Design Week 2026", venue: "ไปรษณีย์กลาง บางรัก กรุงเทพฯ", startsAt: "2026-11-14T11:00:00.000Z" },
    ticketType: "บัตรทั่วไป",
    quantity: 2,
  },
  amount: 1250,
  manual: true,
  orderNumber: "01234567-89ab-cdef-0123-456789abcdef",
} satisfies Props;
