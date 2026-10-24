import type { MailTemplates } from "@app/mail";
import { CtaButton, EventDetails, Greeting, Paragraph } from "./_components/blocks";
import { appUrl, formatMailTime } from "./_components/format";
import { MailLayout } from "./_components/layout";

type Props = MailTemplates["event-invitation"];

export const subject = ({ event }: Props) => `คุณได้รับเชิญเข้าร่วม ${event.title}`;

/** Invitees without an account (`name` null) are sent to sign up with the invited email. */
export default function EventInvitationEmail({ name, email, event, url }: Props) {
  return (
    <MailLayout preview={`${event.title} · ${formatMailTime(event.startsAt)}`} heading="คุณได้รับคำเชิญ">
      <Greeting name={name} />
      <Paragraph>
        คุณได้รับเชิญเข้าร่วมอีเวนต์ <strong>{event.title}</strong>
      </Paragraph>
      <EventDetails event={event} />
      <Paragraph>
        อีเวนต์นี้เปิดให้เฉพาะผู้ได้รับเชิญ กรุณา{name ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}ด้วยอีเมล <strong>{email}</strong>{" "}
        เพื่อดูรายละเอียดและลงทะเบียน
      </Paragraph>
      <CtaButton href={url}>{name ? "ดูอีเวนต์" : "สมัครสมาชิกและดูอีเวนต์"}</CtaButton>
    </MailLayout>
  );
}

EventInvitationEmail.PreviewProps = {
  name: null,
  email: "guest@example.com",
  event: { title: "Founders Dinner: Q4 2026", venue: "Sindhorn Kempinski, ถนนหลังสวน", startsAt: "2026-12-05T12:00:00.000Z" },
  url: `${appUrl}/register?redirect=${encodeURIComponent("/events/founders-dinner-q4-2026")}`,
} satisfies Props;
