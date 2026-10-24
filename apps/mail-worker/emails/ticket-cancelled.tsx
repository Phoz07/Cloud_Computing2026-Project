import type { MailTemplates } from "@app/mail";
import { EventDetails, Greeting, Paragraph } from "./_components/blocks";
import { MailLayout } from "./_components/layout";

type Props = MailTemplates["ticket-cancelled"];

export const subject = ({ order }: Props) => `ตั๋วของคุณถูกยกเลิก: ${order.event.title}`;

/** To an attendee who isn't the buyer, when the order their ticket came with is cancelled. */
export default function TicketCancelledEmail({ name, buyerName, order }: Props) {
  return (
    <MailLayout preview={`ตั๋ว ${order.event.title} ใช้เช็กอินไม่ได้อีก`} heading="ตั๋วของคุณถูกยกเลิก">
      <Greeting name={name} />
      <Paragraph>
        {buyerName ? `ตั๋วที่คุณ ${buyerName} ซื้อไว้` : "ตั๋วของคุณ"}ถูกยกเลิกแล้ว จึงใช้ตั๋วและ QR code เช็กอินไม่ได้อีก
      </Paragraph>
      <EventDetails event={order.event} ticketType={order.ticketType} quantity={order.quantity} />
    </MailLayout>
  );
}

TicketCancelledEmail.PreviewProps = {
  name: "สมศรี มีสุข",
  buyerName: "สมชาย ใจดี",
  order: {
    event: { title: "Bangkok Design Week 2026", venue: "ไปรษณีย์กลาง บางรัก กรุงเทพฯ", startsAt: "2026-11-14T11:00:00.000Z" },
    ticketType: "บัตรทั่วไป",
    quantity: 2,
  },
} satisfies Props;
