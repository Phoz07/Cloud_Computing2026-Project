import type { MailTemplates } from "@app/mail";
import { CtaButton, EventDetails, Greeting, Paragraph } from "./_components/blocks";
import { appUrl, baht } from "./_components/format";
import { MailLayout } from "./_components/layout";

type Props = MailTemplates["refund-failed"];

export const subject = ({ order }: Props) => `คืนเงินไม่สำเร็จ: ${order.event.title}`;

/** Stripe couldn't return the money (it's back in the Stripe balance). */
export default function RefundFailedEmail({ name, order, amount, url }: Props) {
  return (
    <MailLayout preview={`การคืนเงิน ${baht(amount)} ไม่สำเร็จ`} heading="คืนเงินไม่สำเร็จ">
      <Greeting name={name} />
      <Paragraph>
        การคืนเงิน <strong>{baht(amount)}</strong> ไม่สำเร็จ เพราะธนาคารหรือช่องทางที่คุณชำระไม่รับเงินคืน
      </Paragraph>
      <EventDetails
        event={order.event}
        ticketType={order.ticketType}
        quantity={order.quantity}
        extra={[["ยอดคืน", baht(amount)]]}
      />
      <Paragraph>กรุณาติดต่อผู้จัดงานเพื่อรับเงินคืนทางช่องทางอื่น</Paragraph>
      <CtaButton href={url}>ดูรายการ</CtaButton>
    </MailLayout>
  );
}

RefundFailedEmail.PreviewProps = {
  name: "สมชาย ใจดี",
  order: {
    event: { title: "Bangkok Design Week 2026", venue: "ไปรษณีย์กลาง บางรัก กรุงเทพฯ", startsAt: "2026-11-14T11:00:00.000Z" },
    ticketType: "บัตรทั่วไป",
    quantity: 2,
  },
  amount: 1250,
  url: `${appUrl}/tickets/orders/01234567-89ab-cdef-0123-456789abcdef`,
} satisfies Props;
