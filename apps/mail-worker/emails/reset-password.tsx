import type { MailTemplates } from "@app/mail";
import { Link } from "react-email";
import { CtaButton, Fineprint, Paragraph } from "./_components/blocks";
import { appUrl } from "./_components/format";
import { MailLayout } from "./_components/layout";

type Props = MailTemplates["reset-password"];

export const subject = (_: Props) => "รีเซ็ตรหัสผ่าน Eventide";

export default function ResetPasswordEmail({ url }: Props) {
  return (
    <MailLayout preview="กดปุ่มในอีเมลนี้เพื่อตั้งรหัสผ่านใหม่" heading="ตั้งรหัสผ่านใหม่">
      <Paragraph>เราได้รับคำขอรีเซ็ตรหัสผ่านบัญชี Eventide ของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่</Paragraph>
      <CtaButton href={url}>ตั้งรหัสผ่านใหม่</CtaButton>
      <Fineprint>
        ถ้ากดปุ่มไม่ได้ ให้เปิดลิงก์นี้ในเบราว์เซอร์{" "}
        <Link href={url} className="break-all text-primary underline">
          {url}
        </Link>
      </Fineprint>
      <Fineprint>หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องดำเนินการใดๆ รหัสผ่านเดิมยังใช้ได้ตามปกติ</Fineprint>
    </MailLayout>
  );
}

ResetPasswordEmail.PreviewProps = {
  url: `${appUrl}/api/auth/reset-password/Xr4tQ9pLm2?callbackURL=${encodeURIComponent(`${appUrl}/reset-password`)}`,
} satisfies Props;
