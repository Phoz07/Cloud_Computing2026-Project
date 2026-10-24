import type { MailTemplates } from "@app/mail";
import { CtaButton, EventDetails, Greeting, Paragraph } from "./_components/blocks";
import { appUrl, formatMailTime } from "./_components/format";
import { MailLayout } from "./_components/layout";

type Props = MailTemplates["enrollment-approved"];

export const subject = ({ order }: Props) => `คำขอของคุณได้รับการอนุมัติ: ${order.event.title}`;

/** A paid approval enrollment: the buyer has until `payBy` to pay for the tickets. */
export default function EnrollmentApprovedEmail({ name, order, payBy, url }: Props) {
  return (
    <MailLayout preview={`ชำระเงินภายใน ${formatMailTime(payBy)} เพื่อรับตั๋ว`} heading="คำขอได้รับการอนุมัติ">
      <Greeting name={name} />
      <Paragraph>ผู้จัดงานอนุมัติคำขอของคุณแล้ว</Paragraph>
      <EventDetails event={order.event} ticketType={order.ticketType} quantity={order.quantity} />
      <Paragraph>
        กรุณาชำระเงินภายใน <strong>{formatMailTime(payBy)}</strong> เพื่อรับตั๋ว
      </Paragraph>
      <CtaButton href={url}>ชำระเงิน</CtaButton>
    </MailLayout>
  );
}

EnrollmentApprovedEmail.PreviewProps = {
  name: "สมชาย ใจดี",
  order: {
    event: { title: "Design Systems Meetup #12", venue: "True Digital Park, สุขุมวิท 101", startsAt: "2026-11-20T11:30:00.000Z" },
    ticketType: "ผู้เข้าร่วม (คัดเลือก)",
    quantity: 2,
  },
  payBy: "2026-10-27T09:15:00.000Z",
  url: `${appUrl}/tickets/orders/01234567-89ab-cdef-0123-456789abcdef`,
} satisfies Props;
