import { BadgeCheck, Ban, Clock, XCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/lib/organizer-applications";

const statuses: Record<
  ApplicationStatus,
  { icon: LucideIcon; label: string; variant: "secondary" | "default" | "destructive" | "outline" }
> = {
  pending: { icon: Clock, label: "รอตรวจสอบ", variant: "secondary" },
  approved: { icon: BadgeCheck, label: "อนุมัติแล้ว", variant: "default" },
  rejected: { icon: XCircle, label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { icon: Ban, label: "ยกเลิกแล้ว", variant: "outline" },
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const { icon: Icon, label, variant } = statuses[status];
  return (
    <Badge data-slot="application-status-badge" variant={variant}>
      <Icon data-icon="inline-start" />
      {label}
    </Badge>
  );
}
