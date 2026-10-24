import type { MailTemplates } from "@app/mail";
import { EventDetails, Greeting, Note, Paragraph } from "./_components/blocks";
import { MailLayout } from "./_components/layout";

type Props = MailTemplates["enrollment-rejected"];

export const subject = ({ order }: Props) => `คำขอของคุณไม่ได้รับการอนุมัติ: ${order.event.title}`;

export default function EnrollmentRejectedEmail({ name, order, reason }: Props) {
  return (
    <MailLayout preview={`ผู้จัดงาน ${order.event.title} ไม่ได้อนุมัติคำขอของคุณ`} heading="คำขอไม่ได้รับการอนุมัติ">
      <Greeting name={name} />
      <Paragraph>ขออภัย ผู้จัดงานไม่ได้อนุมัติคำขอของคุณ</Paragraph>
      <EventDetails event={order.event} ticketType={order.ticketType} quantity={order.quantity} />
      {reason && <Note label="เหตุผลจากผู้จัดงาน">{reason}</Note>}
    </MailLayout>
  );
}

EnrollmentRejectedEmail.PreviewProps = {
  name: "สมชาย ใจดี",
  order: {
    event: { title: "Design Systems Meetup #12", venue: "True Digital Park, สุขุมวิท 101", startsAt: "2026-11-20T11:30:00.000Z" },
    ticketType: "ผู้เข้าร่วม (คัดเลือก)",
    quantity: 1,
  },
  reason: "รอบนี้ที่นั่งเต็มแล้ว ขอบคุณที่สนใจ แล้วพบกันครั้งหน้า",
} satisfies Props;
