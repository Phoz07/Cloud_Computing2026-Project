import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";
import { ComingSoon } from "./-components/coming-soon";

export const Route = createFileRoute("/_authed/dashboard/events/$eventId/refunds")({ component: RefundsTab });

function RefundsTab() {
  return (
    <ComingSoon icon={ReceiptText} title="คำขอคืนเงิน" description="ตรวจสอบคำขอคืนเงินและประวัติการคืนเงินตามนโยบายของอีเวนต์" />
  );
}
