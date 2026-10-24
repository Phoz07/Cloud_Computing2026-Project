import { createColumnHelper } from "@tanstack/react-table";
import { Bot, Megaphone, ShoppingBag, UserX } from "lucide-react";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { RefundStatusBadge } from "@/components/refund-status-badge";
import { formatBaht, formatDateTime, formatPrice } from "@/lib/format";
import { refundFailureReason, systemRefundReason, type EventRefund } from "@/lib/refunds";
import { kindInfo } from "@/lib/ticket-types";

const columnHelper = createColumnHelper<DataTableFeatures, EventRefund>();

export const refundColumns = columnHelper.columns([
  columnHelper.display({
    id: "buyer",
    header: "ผู้ซื้อ",
    cell: ({ row }) => {
      const { buyer } = row.original;
      if (!buyer) {
        return (
          <span className="flex items-center gap-2 text-muted-foreground">
            <UserX className="size-4" />
            บัญชีถูกลบแล้ว
          </span>
        );
      }
      return (
        <div className="flex min-w-48 flex-col">
          <span className="truncate font-medium">{buyer.name}</span>
          <span className="truncate text-sm text-muted-foreground">{buyer.email}</span>
        </div>
      );
    },
  }),
  columnHelper.display({
    id: "ticket",
    header: "ตั๋ว",
    cell: ({ row }) => {
      const { ticketType, quantity } = row.original;
      const { icon: Icon } = kindInfo[ticketType.kind];
      return (
        <span className="flex min-w-40 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{ticketType.name}</span>
          <span className="text-muted-foreground tabular-nums">× {quantity}</span>
        </span>
      );
    },
  }),
  columnHelper.accessor("amount", {
    header: "ยอดคืน",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium tabular-nums">{formatBaht(row.original.amount)}</span>
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {row.original.percent}% ของ {formatPrice(row.original.orderTotal)}
        </span>
      </div>
    ),
  }),
  columnHelper.accessor("initiatedBy", {
    header: "ผู้ขอคืน",
    cell: ({ row }) => <Initiator refund={row.original} />,
  }),
  columnHelper.accessor("status", {
    header: "สถานะ",
    cell: ({ row }) => {
      const { status, failureReason } = row.original;
      return (
        <div className="flex flex-col items-start gap-1">
          <RefundStatusBadge status={status} />
          {status === "failed" && failureReason && (
            <span className="text-xs text-muted-foreground">{refundFailureReason[failureReason] ?? failureReason}</span>
          )}
        </div>
      );
    },
  }),
  columnHelper.accessor("createdAt", {
    header: "เมื่อ",
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>,
  }),
]);

function Initiator({ refund }: { refund: EventRefund }) {
  const [Icon, label, detail] =
    refund.initiatedBy === "buyer"
      ? [ShoppingBag, "ผู้ซื้อ", "ตามนโยบายการคืนเงิน"]
      : refund.initiatedBy === "organizer"
        ? [Megaphone, refund.requester?.name ?? "ผู้จัดงาน", refund.note]
        : [Bot, "ระบบ", refund.note && (systemRefundReason[refund.note] ?? refund.note)];
  return (
    <div className="flex min-w-40 items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate">{label}</span>
        {detail && <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>}
      </div>
    </div>
  );
}
