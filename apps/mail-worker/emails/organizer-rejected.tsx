import type { MailTemplates } from "@app/mail";
import { CtaButton, Greeting, Note, Paragraph } from "./_components/blocks";
import { appUrl } from "./_components/format";
import { MailLayout } from "./_components/layout";

type Props = MailTemplates["organizer-rejected"];

export const subject = (_: Props) => "ผลการพิจารณาคำขอเป็นผู้จัดงาน";

export default function OrganizerRejectedEmail({ name, organizationName, note, url }: Props) {
  return (
    <MailLayout preview={`คำขอในนาม ${organizationName} ยังไม่ได้รับการอนุมัติ`} heading="คำขอยังไม่ได้รับการอนุมัติ">
      <Greeting name={name} />
      <Paragraph>
        คำขอเป็นผู้จัดงานในนาม <strong>{organizationName}</strong> ยังไม่ได้รับการอนุมัติ
      </Paragraph>
      {note && <Note label="หมายเหตุจากผู้ดูแล">{note}</Note>}
      <Paragraph>คุณแก้ไขข้อมูลและยื่นคำขอใหม่ได้จากหน้าโปรไฟล์</Paragraph>
      <CtaButton href={url}>ไปที่หน้าโปรไฟล์</CtaButton>
    </MailLayout>
  );
}

OrganizerRejectedEmail.PreviewProps = {
  name: "สมหญิง รักงาน",
  organizationName: "Bangkok Indie Collective",
  note: "กรุณาแนบลิงก์เพจหรือเว็บไซต์ขององค์กร และช่องทางติดต่อที่ยืนยันได้",
  url: `${appUrl}/profile/organizer`,
} satisfies Props;
