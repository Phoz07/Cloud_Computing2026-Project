import type { MailTemplates } from "@app/mail";
import { CtaButton, Greeting, Paragraph } from "./_components/blocks";
import { appUrl } from "./_components/format";
import { MailLayout } from "./_components/layout";

type Props = MailTemplates["organizer-approved"];

export const subject = (_: Props) => "คำขอเป็นผู้จัดงานได้รับการอนุมัติแล้ว";

export default function OrganizerApprovedEmail({ name, organizationName, url }: Props) {
  return (
    <MailLayout preview={`คำขอในนาม ${organizationName} ได้รับการอนุมัติแล้ว`} heading="คุณเป็นผู้จัดงานแล้ว">
      <Greeting name={name} />
      <Paragraph>
        คำขอเป็นผู้จัดงานในนาม <strong>{organizationName}</strong> ได้รับการอนุมัติแล้ว
        ตอนนี้คุณสร้างและจัดการอีเวนต์ได้จากแดชบอร์ด
      </Paragraph>
      <CtaButton href={url}>ไปที่แดชบอร์ด</CtaButton>
    </MailLayout>
  );
}

OrganizerApprovedEmail.PreviewProps = {
  name: "สมหญิง รักงาน",
  organizationName: "Bangkok Indie Collective",
  url: `${appUrl}/dashboard`,
} satisfies Props;
