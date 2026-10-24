import { queryOptions } from "@tanstack/react-query";
import { Ban, CircleCheckBig, CircleX, Hourglass, Landmark, type LucideIcon } from "lucide-react";
import { paymentClient } from "./api";
import { enrollmentsKey } from "./enrollments";

export type RefundStatus = "pending" | "requires_action" | "succeeded" | "failed" | "canceled";

type BadgeVariant = "secondary" | "default" | "outline" | "destructive";

export const refundStatusInfo: Record<RefundStatus, { label: string; icon: LucideIcon; variant: BadgeVariant }> = {
  pending: { label: "กำลังคืนเงิน", icon: Hourglass, variant: "secondary" },
  // made by hand (not a card payment, e.g. PromptPay): the buyer was mailed how to send us a bank account
  requires_action: { label: "รอข้อมูลบัญชี", icon: Landmark, variant: "outline" },
  succeeded: { label: "คืนเงินแล้ว", icon: CircleCheckBig, variant: "default" },
  failed: { label: "คืนเงินไม่สำเร็จ", icon: CircleX, variant: "destructive" },
  canceled: { label: "ยกเลิกการคืนเงิน", icon: Ban, variant: "outline" },
};

/** Why the system refunded a payment by itself (the refund's note). */
export const systemRefundReason: Record<string, string> = {
  duplicate: "ชำระซ้ำ",
  unavailable: "ชำระหลังหมดเวลาจอง ที่นั่งเต็มแล้ว",
};

/** Stripe's failure_reason codes in Thai; anything else shows as the code. */
export const refundFailureReason: Record<string, string> = {
  lost_or_stolen_card: "บัตรถูกแจ้งหายหรือถูกขโมย",
  expired_or_canceled_card: "บัตรหมดอายุหรือถูกยกเลิก",
  declined: "ธนาคารปฏิเสธการคืนเงิน",
  insufficient_funds: "ยอดเงินในบัญชี Stripe ไม่พอ",
  charge_for_pending_refund_disputed: "การชำระเงินถูกโต้แย้ง",
  merchant_request: "ยกเลิกโดยผู้ขาย",
};

/** Whether the buyer may still cancel for a refund under the order's terms. */
export const isRefundOpen = (terms: { deadline: string }) => new Date(terms.deadline) > new Date();

// under enrollmentsKey: a refund cancels its order, so invalidating enrollments refreshes both
export const eventRefundsKey = (eventId: string) => [...enrollmentsKey, "refunds", eventId] as const;

export const eventRefundsQueryOptions = (
  eventId: string,
  query: { page?: number; pageSize?: number; status?: RefundStatus },
) =>
  queryOptions({
    queryKey: [...eventRefundsKey(eventId), query],
    queryFn: async () => {
      const { data, error } = await paymentClient.api.payment.events({ eventId }).refunds.get({ query });
      if (error) throw error;
      return data;
    },
  });

export type EventRefund = NonNullable<
  Awaited<ReturnType<ReturnType<typeof paymentClient.api.payment.events>["refunds"]["get"]>>["data"]
>["items"][number];
