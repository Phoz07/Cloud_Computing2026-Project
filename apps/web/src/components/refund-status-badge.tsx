import { Badge } from "@/components/ui/badge";
import { refundStatusInfo, type RefundStatus } from "@/lib/refunds";

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const { label, icon: Icon, variant } = refundStatusInfo[status];
  return (
    <Badge variant={variant}>
      <Icon data-icon="inline-start" />
      {label}
    </Badge>
  );
}
