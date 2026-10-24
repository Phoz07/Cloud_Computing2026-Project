import { Heading, Section, Text } from "react-email";
import { Paragraph } from "./blocks";

// Where buyers claim a refund we make by hand. Mock values: replace them with the real channels.
export const refundContacts = [
  ["อีเมล", "refunds@eventide.example"],
  ["LINE", "@eventide"],
  ["โทร", "02-123-4567 (จันทร์–ศุกร์ 9:00–18:00 น.)"],
] as const;

/**
 * How the money gets back to the buyer. A refund made by hand (`manual`, see apps/payment
 * libs/refund.ts) asks for their order number and bank account, sent to us.
 */
export function RefundOutcome({ manual, orderNumber }: { manual: boolean; orderNumber: string }) {
  if (!manual) return <Paragraph>เงินจะกลับเข้าช่องทางที่คุณชำระภายใน 5–10 วันทำการ</Paragraph>;
  return (
    <Section className="my-6 rounded-[8px] border border-solid border-border px-5 py-4">
      <Heading as="h2" className="m-0 mb-2 text-base font-semibold leading-7 text-foreground">
        วิธีรับเงินคืน
      </Heading>
      <Text className="m-0 text-sm leading-6 text-foreground">
        ช่องทางที่คุณใช้ชำระ (เช่น PromptPay) คืนเงินอัตโนมัติไม่ได้ เราจะโอนเงินคืนให้คุณเอง กรุณาติดต่อเราพร้อมแจ้ง
      </Text>
      <ul className="my-2 pl-5 text-sm leading-6 text-foreground">
        <li>
          เลขคำสั่งซื้อ: <strong className="font-mono">{orderNumber}</strong>
        </li>
        <li>ชื่อบัญชี เลขบัญชี และธนาคารที่ใช้ชำระ</li>
      </ul>
      <Text className="m-0 mt-3 text-sm font-medium leading-6 text-foreground">ช่องทางติดต่อ</Text>
      <ul className="my-2 pl-5 text-sm leading-6 text-foreground">
        {refundContacts.map(([label, value]) => (
          <li key={label}>
            {label}: {value}
          </li>
        ))}
      </ul>
    </Section>
  );
}
