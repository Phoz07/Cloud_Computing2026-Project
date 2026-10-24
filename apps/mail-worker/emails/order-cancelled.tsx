import type { MailTemplates } from "@app/mail";
import { CtaButton, EventDetails, Greeting, Note, Paragraph } from "./_components/blocks";
import { appUrl, baht } from "./_components/format";
import { MailLayout } from "./_components/layout";
import { RefundOutcome } from "./_components/refund-claim";

type Props = MailTemplates["order-cancelled"];

export const subject = ({ manual, order }: Props) =>
  `${manual ? "ยกเลิกคำสั่งซื้อแล้ว วิธีรับเงินคืน" : "ยกเลิกคำสั่งซื้อและคืนเงินแล้ว"}: ${order.event.title}`;

/** To the buyer: the organizer cancelled the order with a full refund, or the buyer asked for the policy's refund. */
export default function OrderCancelledEmail(props: Props) {
  const { name, byOrganizer, note, order, amount, percent, total, manual, orderNumber, url } = props;
  return (
    <MailLayout preview={`ยอดคืน ${baht(amount)} · ${order.event.title}`} heading="ยกเลิกคำสั่งซื้อแล้ว">
      <Greeting name={name} />
      <Paragraph>
        {byOrganizer ? "ผู้จัดงานยกเลิกคำสั่งซื้อของคุณ และคืนเงินเต็มจำนวน" : "ยกเลิกคำสั่งซื้อตามคำขอของคุณแล้ว"}
      </Paragraph>
      {byOrganizer && note && <Note label="ข้อความจากผู้จัดงาน">{note}</Note>}
      <EventDetails
        event={order.event}
        ticketType={order.ticketType}
        quantity={order.quantity}
        extra={[["ยอดคืน", `${baht(amount)} (${percent}% ของ ${baht(total)})`]]}
      />
      <RefundOutcome manual={manual} orderNumber={orderNumber} />
      <CtaButton href={url}>ดูรายการ</CtaButton>
    </MailLayout>
  );
}

OrderCancelledEmail.PreviewProps = {
  name: "สมชาย ใจดี",
  byOrganizer: true,
  note: "งานเลื่อนออกไปเพราะสถานที่ปิดปรับปรุง ขออภัยในความไม่สะดวก",
  order: {
    event: { title: "Bangkok Design Week 2026", venue: "ไปรษณีย์กลาง บางรัก กรุงเทพฯ", startsAt: "2026-11-14T11:00:00.000Z" },
    ticketType: "บัตรทั่วไป",
    quantity: 2,
  },
  amount: 1250,
  percent: 100,
  total: 1250,
  manual: false,
  orderNumber: "01234567-89ab-cdef-0123-456789abcdef",
  url: `${appUrl}/tickets/orders/01234567-89ab-cdef-0123-456789abcdef`,
} satisfies Props;
