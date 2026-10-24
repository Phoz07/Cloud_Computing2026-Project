import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Check,
  ClipboardCheck,
  Clock,
  Eye,
  History,
  MessageSquareText,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { ApplicationDetails } from "@/components/application-details";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { SubmitButton, TextField } from "@/components/form-field";
import { UserAvatar } from "@/components/user-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { adminUsersKey } from "@/lib/admin-users";
import { authClient } from "@/lib/api";
import { problemMessage } from "@/lib/auth-errors";
import { formatDateTime } from "@/lib/format";
import {
  applicantHistoryQueryOptions,
  type ApplicationRow,
  type ApplicationStatus,
} from "@/lib/organizer-applications";

const columnHelper = createColumnHelper<DataTableFeatures, ApplicationRow>();

export const statusBadges: Record<
  ApplicationStatus,
  { label: string; icon: typeof Clock; variant: "outline" | "secondary" | "destructive" | "ghost" }
> = {
  pending: { label: "รอพิจารณา", icon: Clock, variant: "outline" },
  approved: { label: "อนุมัติแล้ว", icon: BadgeCheck, variant: "secondary" },
  rejected: { label: "ปฏิเสธแล้ว", icon: XCircle, variant: "destructive" },
  cancelled: { label: "ผู้สมัครยกเลิก", icon: Ban, variant: "ghost" },
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { label, icon: Icon, variant } = statusBadges[status];
  return (
    <Badge variant={variant}>
      <Icon data-icon="inline-start" />
      {label}
    </Badge>
  );
}

export const applicationColumns = columnHelper.columns([
  columnHelper.display({
    id: "applicant",
    header: "ผู้สมัคร",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <UserAvatar user={row.original.applicant} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.original.applicant.name}</span>
          <span className="truncate text-sm text-muted-foreground">{row.original.applicant.email}</span>
        </div>
      </div>
    ),
  }),
  columnHelper.accessor("organizationName", {
    header: "องค์กร / ช่องทางติดต่อ",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.organizationName}</span>
        <span className="text-sm text-muted-foreground">{row.original.contact}</span>
      </div>
    ),
  }),
  columnHelper.accessor("reason", {
    header: "รายละเอียด",
    cell: ({ row }) => (
      <p className="max-w-xs truncate" title={row.original.reason}>
        {row.original.reason}
      </p>
    ),
  }),
  columnHelper.accessor("createdAt", {
    header: "ส่งเมื่อ",
    cell: ({ getValue }) => formatDateTime(getValue()),
  }),
  columnHelper.accessor("status", {
    header: "สถานะ",
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
  }),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">พิจารณา</span>,
    cell: ({ row }) => <ApplicationDialog application={row.original} />,
  }),
]);

function useReviewed() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["organizer-applications"] }),
      // approving changes a role, so user counts and the users table move too
      queryClient.invalidateQueries({ queryKey: adminUsersKey }),
    ]);
}

const rejectSchema = z.object({ note: z.string().trim().max(1000, "ยาวเกินไป") });

/**
 * Full application plus the review actions; long reasons stay out of the table rows.
 * Rejecting is a step inside this dialog; approving opens a nested confirm dialog,
 * and DialogContent sinks back behind it (data-nested-dialog-open).
 */
function ApplicationDialog({ application }: { application: ApplicationRow }) {
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const pending = application.status === "pending";
  const close = () => setOpen(false);

  return (
    <div className="flex justify-end">
      <Dialog
        open={open}
        onOpenChange={setOpen}
        // reset only once the close animation ends, so the content doesn't jump while fading out
        onOpenChangeComplete={(next) => !next && setRejecting(false)}
      >
        <DialogTrigger render={<Button size="sm" variant={pending ? "default" : "outline"} />}>
          {pending ? <ClipboardCheck data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
          {pending ? "พิจารณา" : "ดูรายละเอียด"}
        </DialogTrigger>
        <DialogContent>
          {rejecting ? (
            <RejectForm application={application} onBack={() => setRejecting(false)} onDone={close} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>คำขอของ {application.applicant.name}</DialogTitle>
                <DialogDescription>{application.applicant.email}</DialogDescription>
              </DialogHeader>
              <div className="-mx-6 flex max-h-[60vh] flex-col gap-6 overflow-y-auto px-6">
                <ApplicationDetails application={application} />
                <Separator />
                <ApplicantHistory application={application} />
              </div>
              {pending && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRejecting(true)}>
                    <X data-icon="inline-start" />
                    ปฏิเสธ
                  </Button>
                  <ApproveButton application={application} onDone={close} />
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The applicant's other applications, so a reviewer sees earlier rejections and withdrawals. */
function ApplicantHistory({ application }: { application: ApplicationRow }) {
  const { data, isPending } = useQuery(applicantHistoryQueryOptions(application.applicant.id));
  const others = data?.filter((item) => item.id !== application.id);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 font-medium">
        <History className="size-4" />
        ประวัติคำขอ
      </h3>
      {isPending ? (
        <Skeleton className="h-16" />
      ) : !others?.length ? (
        <p className="text-muted-foreground">ยังไม่เคยยื่นคำขอมาก่อน</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {others.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{item.organizationName}</span>
                <StatusBadge status={item.status} />
              </div>
              <span className="text-xs text-muted-foreground">ส่งเมื่อ {formatDateTime(item.createdAt)}</span>
              {item.reviewNote && (
                <p className="break-words whitespace-pre-wrap text-muted-foreground">หมายเหตุ: {item.reviewNote}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ApproveButton({ application, onDone }: { application: ApplicationRow; onDone: () => void }) {
  const reviewed = useReviewed();
  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.api.auth["organizer-applications"]({ id: application.id }).approve.post();
      if (error) throw error;
    },
    onSuccess: () => {
      toast.add({
        type: "success",
        title: `อนุมัติ ${application.applicant.name} เป็นผู้จัดงานแล้ว`,
        description: "ระบบส่งอีเมลแจ้งผู้สมัครแล้ว",
      });
      onDone();
      return reviewed();
    },
    onError: (error) => toast.add({ type: "error", title: problemMessage(error) }),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button />}>
        <Check data-icon="inline-start" />
        อนุมัติ
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10 text-primary">
            <BadgeCheck />
          </AlertDialogMedia>
          <AlertDialogTitle>อนุมัติ {application.applicant.name} เป็นผู้จัดงาน?</AlertDialogTitle>
          <AlertDialogDescription>
            ผู้ใช้จะสร้างและจัดการอีเวนต์ในนาม {application.organizationName} ได้ทันที และจะได้รับอีเมลแจ้งผล
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={approve.isPending}>
            <ArrowLeft data-icon="inline-start" />
            กลับ
          </AlertDialogCancel>
          <AlertDialogAction disabled={approve.isPending} onClick={() => approve.mutate()}>
            {approve.isPending ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
            อนุมัติ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RejectForm({
  application,
  onBack,
  onDone,
}: {
  application: ApplicationRow;
  onBack: () => void;
  onDone: () => void;
}) {
  const reviewed = useReviewed();

  const form = useForm({
    defaultValues: { note: "" },
    validators: { onSubmit: rejectSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.api.auth["organizer-applications"]({ id: application.id }).reject.post({
        note: value.note.trim() || undefined,
      });
      if (error) return void toast.add({ type: "error", title: problemMessage(error) });
      toast.add({ type: "success", title: `ปฏิเสธคำขอของ ${application.applicant.name} แล้ว` });
      onDone();
      await reviewed();
    },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>ปฏิเสธคำขอของ {application.applicant.name}</DialogTitle>
        <DialogDescription>หมายเหตุจะถูกส่งไปในอีเมลแจ้งผล ผู้สมัครแก้ไขและยื่นคำขอใหม่ได้</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <form.Field name="note">
          {(field) => (
            <TextField
              field={field}
              label="หมายเหตุถึงผู้สมัคร (ไม่บังคับ)"
              icon={MessageSquareText}
              multiline
              autoFocus
              placeholder="เช่น กรุณาเพิ่มช่องทางติดต่อที่ตรวจสอบได้"
            />
          )}
        </form.Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          กลับ
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <SubmitButton pending={isSubmitting} icon={X} variant="destructive">
              ปฏิเสธคำขอ
            </SubmitButton>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
