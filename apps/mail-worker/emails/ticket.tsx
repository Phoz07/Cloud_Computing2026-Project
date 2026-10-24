import type { MailTemplates } from "@app/mail";
import { CtaButton, EventDetails, Greeting, Paragraph, TicketCode } from "./_components/blocks";
import { appUrl } from "./_components/format";
import { MailLayout } from "./_components/layout";

type Props = MailTemplates["ticket"];

export const subject = ({ event }: Props) => `ตั๋วของคุณ: ${event.title}`;

/** One attendee's ticket. The ticket page needs an account with the ticket's email. */
export default function TicketEmail({ name, email, ticketType, event, code, url, hasAccount }: Props) {
  return (
    <MailLayout preview={`ตั๋ว ${ticketType} สำหรับ ${event.title} พร้อมแล้ว`} heading="ตั๋วของคุณพร้อมแล้ว">
      <Greeting name={name} />
      <Paragraph>
        ตั๋ว <strong>{ticketType}</strong> สำหรับอีเวนต์ <strong>{event.title}</strong> พร้อมแล้ว
      </Paragraph>
      <EventDetails event={event} ticketType={ticketType} />
      <TicketCode code={code} />
      <Paragraph>
        {hasAccount ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}ด้วยอีเมล <strong>{email}</strong> เพื่อดูตั๋วและ QR code
        สำหรับเช็กอินที่หน้างาน
      </Paragraph>
      <CtaButton href={url}>{hasAccount ? "ดูตั๋ว" : "สมัครสมาชิกและดูตั๋ว"}</CtaButton>
    </MailLayout>
  );
}

TicketEmail.PreviewProps = {
  name: "สมชาย ใจดี",
  email: "somchai@example.com",
  ticketType: "บัตรทั่วไป",
  event: { title: "Bangkok Design Week 2026", venue: "ไปรษณีย์กลาง บางรัก กรุงเทพฯ", startsAt: "2026-11-14T11:00:00.000Z" },
  code: "7K3M9QX2TB",
  url: `${appUrl}/tickets/01234567-89ab-cdef-0123-456789abcdef`,
  hasAccount: true,
} satisfies Props;
