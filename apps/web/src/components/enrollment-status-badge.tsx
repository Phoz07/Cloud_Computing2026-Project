import { Badge } from "@/components/ui/badge";
import { enrollmentStatusInfo, type EnrollmentStatus } from "@/lib/enrollments";
import { formatDateTime } from "@/lib/format";

/** The status, and the payment deadline while it waits for payment. */
export function EnrollmentStatusBadge({ enrollment }: { enrollment: { status: EnrollmentStatus; expiresAt: string | null } }) {
  const { label, icon: Icon, variant } = enrollmentStatusInfo[enrollment.status];
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={variant}>
        <Icon data-icon="inline-start" />
        {label}
      </Badge>
      {enrollment.status === "awaiting_payment" && enrollment.expiresAt && (
        <span className="text-xs whitespace-nowrap text-muted-foreground">ภายใน {formatDateTime(enrollment.expiresAt)}</span>
      )}
    </div>
  );
}
