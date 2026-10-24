import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CalendarDays,
  Building2,
  CircleAlert,
  Clock,
  FileText,
  History,
  Inbox,
  MessageSquareText,
  Phone,
  RotateCcw,
  Send,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ApplicationDetails } from "@/components/application-details";
import { ApplicationStatusBadge } from "@/components/application-status-badge";
import { SubmitButton, TextField } from "@/components/form-field";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/api";
import { problemMessage } from "@/lib/auth-errors";
import { formatDateTime } from "@/lib/format";
import {
  myApplicationHistoryQueryOptions,
  myApplicationQueryOptions,
  type ApplicationStatus,
  type MyApplication,
} from "@/lib/organizer-applications";
import { cn } from "@/lib/utils";

// mirrors the limits in apps/auth/src/routes/organizer-applications/model.ts
const applicationSchema = z.object({
  organizationName: z.string().trim().min(2, "กรุณากรอกชื่อองค์กรหรือชื่อผู้จัดงาน").max(120, "ยาวเกินไป"),
  contact: z.string().trim().min(3, "กรุณากรอกช่องทางติดต่อ").max(200, "ยาวเกินไป"),
  reason: z.string().trim().min(10, "กรุณาเล่าอย่างน้อย 10 ตัวอักษร").max(2000, "ยาวเกินไป"),
});

const heroes: Record<ApplicationStatus, { icon: LucideIcon; title: string; tone: string }> = {
  pending: { icon: Clock, title: "รอตรวจสอบ", tone: "bg-secondary text-secondary-foreground" },
  approved: { icon: BadgeCheck, title: "อนุมัติแล้ว", tone: "bg-primary text-primary-foreground" },
  rejected: { icon: XCircle, title: "ไม่อนุมัติ", tone: "bg-destructive/10 text-destructive" },
  cancelled: { icon: Ban, title: "ยกเลิกแล้ว", tone: "bg-muted text-muted-foreground" },
};

type ApplicationInput = z.input<typeof applicationSchema>;

/** The decision, front and center: a large icon, the status, and one line of context. */
function StatusHero({
  status,
  children,
  action,
}: {
  status: ApplicationStatus;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { icon: Icon, title, tone } = heroes[status];
  return (
    <div data-slot="application-status" className="flex flex-col items-center gap-4 py-10 text-center">
      <div className={cn("flex size-24 items-center justify-center rounded-full", tone)}>
        <Icon className="size-12" />
      </div>
      <h2 className="text-3xl font-bold">{title}</h2>
      <p className="max-w-md text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

/** Lets a plain user apply to become an organizer and shows the latest decision. */
export function OrganizerApplication() {
  const { data: application, isPending } = useQuery(myApplicationQueryOptions);
  const [retrying, setRetrying] = useState(false);

  if (isPending) return <Skeleton className="h-64" />;

  if (application?.status === "pending") {
    return (
      <StatusHero
        status="pending"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ViewApplication application={application} />
            <CancelApplication />
          </div>
        }
      >
        คำขอในนาม <strong className="text-foreground">{application.organizationName}</strong> ส่งเมื่อ{" "}
        {formatDateTime(application.createdAt)} เราจะแจ้งผลทางอีเมล
      </StatusHero>
    );
  }

  if (application?.status === "approved") {
    return (
      <StatusHero
        status="approved"
        action={
          <Link to="/dashboard/events" className={buttonVariants({ size: "lg" })}>
            <CalendarDays data-icon="inline-start" />
            จัดการอีเว็นต์ของฉัน
          </Link>
        }
      >
        คุณเป็นผู้จัดงานแล้ว เริ่มสร้างและจัดการอีเวนต์ได้เลย
      </StatusHero>
    );
  }

  if (application?.status === "rejected") {
    return retrying ? (
      // starts from the rejected answers so the user only fixes what the reviewer pointed out
      <ApplicationForm
        defaultValues={{
          organizationName: application.organizationName,
          contact: application.contact,
          reason: application.reason,
        }}
        onBack={() => setRetrying(false)}
      />
    ) : (
      <StatusHero
        status="rejected"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => setRetrying(true)}>
              <RotateCcw data-icon="inline-start" />
              ยื่นคำขอใหม่
            </Button>
            <ApplicationHistory />
          </div>
        }
      >
        {application.reviewNote ? `หมายเหตุ: ${application.reviewNote}` : "คุณแก้ไขข้อมูลและยื่นคำขอใหม่ได้"}
      </StatusHero>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {application?.status === "cancelled" && (
        <Alert>
          <Ban />
          <AlertDescription>คุณยกเลิกคำขอล่าสุดแล้ว ยื่นคำขอใหม่ได้ด้านล่าง</AlertDescription>
          <AlertAction>
            <ApplicationHistory size="sm" />
          </AlertAction>
        </Alert>
      )}
      <ApplicationForm />
    </div>
  );
}

/** Read-only copy of what the user submitted. */
function ViewApplication({ application }: { application: MyApplication }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="lg" onClick={() => setOpen(true)}>
        <FileText data-icon="inline-start" />
        ดูคำขอของฉัน
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>คำขอเป็นผู้จัดงาน</DialogTitle>
            <DialogDescription>ข้อมูลที่คุณส่งไว้ แก้ไขไม่ได้ระหว่างรอพิจารณา</DialogDescription>
          </DialogHeader>
          <ApplicationDetails application={application} className="max-h-[60vh] overflow-y-auto" />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Every application the user has sent, newest first, with each outcome. */
function ApplicationHistory({ size = "lg" }: { size?: "sm" | "lg" }) {
  const [open, setOpen] = useState(false);
  const { data: history, isPending } = useQuery({ ...myApplicationHistoryQueryOptions, enabled: open });

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <History data-icon="inline-start" />
        ประวัติคำขอ
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ประวัติคำขอเป็นผู้จัดงาน</DialogTitle>
            <DialogDescription>คำขอทั้งหมดที่คุณเคยส่ง เรียงจากล่าสุด</DialogDescription>
          </DialogHeader>
          <div className="-mx-6 max-h-[60vh] overflow-y-auto px-6">
            {isPending ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : !history?.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox />
                  </EmptyMedia>
                  <EmptyTitle>ยังไม่มีประวัติคำขอ</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <ol className="flex flex-col gap-3">
                {history.map((item) => (
                  <li key={item.id} className="flex flex-col gap-3 rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <ApplicationStatusBadge status={item.status} />
                      {item.reviewedAt && (
                        <span className="text-xs text-muted-foreground">
                          พิจารณาเมื่อ {formatDateTime(item.reviewedAt)}
                        </span>
                      )}
                    </div>
                    <ApplicationDetails application={item} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CancelApplication() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.api.auth["organizer-applications"].me.delete();
      if (error) throw error;
    },
    onSuccess: async () => {
      setOpen(false);
      toast.add({ type: "success", title: "ยกเลิกคำขอเรียบร้อย" });
      await queryClient.invalidateQueries({ queryKey: myApplicationQueryOptions.queryKey });
    },
    onError: (error) => toast.add({ type: "error", title: problemMessage(error) }),
  });

  return (
    <>
      <Button variant="destructive" size="lg" onClick={() => setOpen(true)}>
        <Undo2 data-icon="inline-start" />
        ยกเลิกคำขอ
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Undo2 />
            </AlertDialogMedia>
            <AlertDialogTitle>ยกเลิกคำขอเป็นผู้จัดงาน?</AlertDialogTitle>
            <AlertDialogDescription>คำขอนี้จะถูกลบ คุณยื่นคำขอใหม่ได้ภายหลัง</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>เก็บคำขอไว้</AlertDialogCancel>
            <Button variant="destructive" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {cancel.isPending ? <Spinner data-icon="inline-start" /> : <Undo2 data-icon="inline-start" />}
              ยกเลิกคำขอ
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ApplicationForm({
  defaultValues = { organizationName: "", contact: "", reason: "" },
  onBack,
}: {
  defaultValues?: ApplicationInput;
  onBack?: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues,
    validators: { onSubmit: applicationSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const { error } = await authClient.api.auth["organizer-applications"].post({
        organizationName: value.organizationName.trim(),
        contact: value.contact.trim(),
        reason: value.reason.trim(),
      });
      if (error) return setFormError(problemMessage(error));
      toast.add({ type: "success", title: "ส่งคำขอเรียบร้อย", description: "เราจะแจ้งผลการพิจารณาทางอีเมล" });
      await queryClient.invalidateQueries({ queryKey: myApplicationQueryOptions.queryKey });
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        {formError && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <form.Field name="organizationName">
          {(field) => <TextField field={field} label="ชื่อองค์กรหรือชื่อผู้จัดงาน" icon={Building2} autoComplete="organization" />}
        </form.Field>
        <form.Field name="contact">
          {(field) => (
            <TextField
              field={field}
              label="ช่องทางติดต่อ"
              icon={Phone}
              placeholder="เบอร์โทร, LINE ID หรือเว็บไซต์"
            />
          )}
        </form.Field>
        <form.Field name="reason">
          {(field) => (
            <TextField
              field={field}
              label="อีเวนต์ที่คุณวางแผนจะจัด"
              icon={MessageSquareText}
              multiline
              placeholder="เล่าประเภทอีเวนต์ ขนาดงาน และประสบการณ์ที่ผ่านมา"
            />
          )}
        </form.Field>
        <div className="flex flex-wrap gap-2">
          {onBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft data-icon="inline-start" />
              กลับ
            </Button>
          )}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <SubmitButton pending={isSubmitting} icon={Send}>
                ส่งคำขอ
              </SubmitButton>
            )}
          </form.Subscribe>
        </div>
      </FieldGroup>
    </form>
  );
}
