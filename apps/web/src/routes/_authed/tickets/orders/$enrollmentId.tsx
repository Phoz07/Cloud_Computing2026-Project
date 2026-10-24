import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, CalendarClock, ChevronRight, CircleCheckBig, CircleX, Clock, CreditCard, Hourglass, Mail, MapPin, QrCode,
  ReceiptText, RefreshCw, TicketX, Undo2, UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { EnrollmentStatusBadge } from "@/components/enrollment-status-badge";
import { PayButton } from "@/components/pay-button";
import { RefundStatusBadge } from "@/components/refund-status-badge";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { paymentClient } from "@/lib/api";
import { problemMessage } from "@/lib/auth-errors";
import { enrollmentQueryOptions, enrollmentsKey, type Enrollment } from "@/lib/enrollments";
import { formatBaht, formatDateRange, formatDateTime, formatPrice } from "@/lib/format";
import { isRefundOpen } from "@/lib/refunds";

// `paid`: Stripe sent the buyer back after paying; the webhook may not have confirmed it yet
export const Route = createFileRoute("/_authed/tickets/orders/$enrollmentId")({
  validateSearch: z.object({ paid: z.unknown().optional() }),
  component: OrderPage,
});

const POLL_MS = 2_000;
const POLL_FOR_MS = 30_000;

function OrderPage() {
  const { enrollmentId } = Route.useParams();
  const { paid } = Route.useSearch();
  // back from Stripe: check again until the webhook confirms it, for a while
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), POLL_FOR_MS);
    return () => clearTimeout(timer);
  }, []);
  const polling = !!paid && !gaveUp;
  const { data: order, isPending, isError } = useQuery({
    ...enrollmentQueryOptions(enrollmentId),
    refetchInterval: (query) => (polling && query.state.data?.status === "awaiting_payment" ? POLL_MS : false),
  });

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4" aria-busy="true" aria-label="กำลังโหลดรายการ">
        <Skeleton className="h-56" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (isError) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TicketX />
          </EmptyMedia>
          <EmptyTitle>ไม่พบรายการนี้</EmptyTitle>
          <EmptyDescription>รายการลงทะเบียนจะแสดงกับบัญชีที่ลงทะเบียนเท่านั้น</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/tickets" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft data-icon="inline-start" />
            ตั๋วของฉัน
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  const confirming = polling && order.status === "awaiting_payment";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
      <Link to="/tickets" className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
        <ArrowLeft data-icon="inline-start" />
        ตั๋วของฉัน
      </Link>
      <OrderStatus order={order} confirming={confirming} afterPayment={!!paid} />
      <OrderSummary order={order} />
      {order.status === "confirmed" && order.total > 0 && <RefundCard order={order} />}
    </div>
  );
}

function OrderStatus({ order, confirming, afterPayment }: { order: Enrollment; confirming: boolean; afterPayment: boolean }) {
  const toEvent = (
    <Link to="/events/$slug" params={{ slug: order.event.slug }} className={buttonVariants({ variant: "outline" })}>
      <ArrowLeft data-icon="inline-start" />
      กลับไปหน้าอีเวนต์
    </Link>
  );
  const status: { icon: typeof Clock; title: string; description: string; actions?: React.ReactNode } = (() => {
    switch (order.status) {
      case "confirmed":
        return {
          icon: CircleCheckBig,
          title: order.ticketType.kind === "approval" ? "ได้รับการอนุมัติแล้ว" : "ลงทะเบียนสำเร็จ",
          description: "ส่งตั๋วไปที่อีเมลของผู้เข้าร่วมแล้ว ผู้เข้าร่วมที่มีบัญชีด้วยอีเมลนั้นจะเห็นตั๋วในหน้าตั๋วของฉันด้วย",
          actions: (
            <Link to="/tickets" className={buttonVariants()}>
              <QrCode data-icon="inline-start" />
              ดูตั๋วของฉัน
            </Link>
          ),
        };
      case "pending":
        return { icon: Hourglass, title: "ส่งคำขอแล้ว", description: "รอผู้จัดงานพิจารณา เราจะแจ้งผลทางอีเมล", actions: toEvent };
      case "awaiting_payment":
        if (confirming) {
          return {
            icon: CreditCard,
            title: "กำลังยืนยันการชำระเงิน",
            description: "รอสักครู่ หน้านี้จะอัปเดตเองเมื่อได้รับการยืนยันจาก Stripe",
          };
        }
        return {
          icon: CreditCard,
          title: afterPayment ? "ยังไม่ได้รับการยืนยันการชำระเงิน" : "รอชำระเงิน",
          description: afterPayment
            ? "หากชำระแล้ว ระบบจะส่งตั๋วทางอีเมลเมื่อยืนยันเสร็จ ไม่ต้องชำระซ้ำ"
            : `ชำระภายใน ${order.expiresAt ? formatDateTime(order.expiresAt) : "เวลาที่กำหนด"} เพื่อรับตั๋ว`,
          // back from Stripe, checking comes first: paying again isn't what they need
          actions: (
            <div className="flex flex-wrap justify-center gap-2">
              <PayButton enrollmentId={order.id} variant={afterPayment ? "outline" : "default"} />
              <VerifyPaymentButton enrollmentId={order.id} variant={afterPayment ? "default" : "outline"} />
            </div>
          ),
        };
      case "rejected":
        return {
          icon: CircleX,
          title: "ไม่ได้รับการอนุมัติ",
          description: "ผู้จัดงานไม่ได้อนุมัติคำขอนี้ ดูเหตุผลได้ในอีเมลแจ้งผล",
          actions: toEvent,
        };
      case "expired":
        return {
          icon: Clock,
          title: "หมดเวลาชำระเงิน",
          description: "ที่นั่งที่จองไว้ถูกปล่อยแล้ว ลงทะเบียนใหม่ได้จากหน้าอีเวนต์หากตั๋วยังเหลือ",
          actions: toEvent,
        };
      case "cancelled":
        return { icon: Undo2, ...cancelledStatus(order), actions: toEvent };
    }
  })();

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{confirming ? <Spinner /> : <status.icon />}</EmptyMedia>
        <EmptyTitle>{status.title}</EmptyTitle>
        <EmptyDescription>{status.description}</EmptyDescription>
      </EmptyHeader>
      {status.actions && <EmptyContent>{status.actions}</EmptyContent>}
    </Empty>
  );
}

/** Has the payment service ask Stripe, for a payment the webhook hasn't confirmed (e.g. it never arrived). */
function VerifyPaymentButton({ enrollmentId, ...props }: { enrollmentId: string } & React.ComponentProps<typeof Button>) {
  const queryClient = useQueryClient();
  const verify = useMutation({
    mutationFn: async () => {
      const { data, error } = await paymentClient.api.payment.checkout.verify.post({ enrollmentId });
      if (error) throw error;
      return data;
    },
    onSuccess: ({ status }) => {
      if (status === "confirmed") {
        toast.add({ type: "success", title: "ยืนยันการชำระเงินแล้ว", description: "ส่งตั๋วไปที่อีเมลของผู้เข้าร่วมแล้ว" });
      } else if (status === "awaiting_payment") {
        toast.add({ type: "info", title: "ยังไม่พบการชำระเงิน", description: "หากเพิ่งชำระ รอสักครู่แล้วตรวจสอบอีกครั้ง" });
      }
      // anything else (e.g. the hold ran out) shows on the page itself
    },
    onError: (error) => toast.add({ type: "error", title: problemMessage(error) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: enrollmentsKey }),
  });
  return (
    <Button {...props} disabled={verify.isPending || props.disabled} onClick={() => verify.mutate()}>
      {verify.isPending ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
      ตรวจสอบการชำระเงิน
    </Button>
  );
}

/** What happened to a cancelled order's money, by the state of the refund that cancelled it. */
function cancelledStatus(order: Enrollment) {
  const refund = order.refunds.at(-1);
  const title = refund?.initiatedBy === "organizer" ? "ผู้จัดงานยกเลิกรายการนี้" : "ยกเลิกรายการแล้ว";
  if (!refund) return { title, description: "ตั๋วในรายการนี้ใช้เช็กอินไม่ได้แล้ว" };
  const amount = formatBaht(refund.amount);
  switch (refund.status) {
    case "succeeded":
    case "pending":
      return {
        title,
        description: `${refund.status === "succeeded" ? "คืนเงิน" : "กำลังคืนเงิน"} ${amount} เงินจะกลับเข้าช่องทางที่คุณชำระภายใน 5–10 วันทำการ`,
      };
    case "requires_action":
      return {
        title,
        description: `ช่องทางที่คุณชำระคืนเงินอัตโนมัติไม่ได้ เราส่งอีเมลวิธีรับเงินคืน ${amount} ไปแล้ว กรุณาติดต่อเราพร้อมเลขคำสั่งซื้อ ${order.id}`,
      };
    case "failed":
    case "canceled":
      return { title, description: `คืนเงิน ${amount} ไม่สำเร็จ กรุณาติดต่อผู้จัดงานเพื่อรับเงินคืนทางช่องทางอื่น` };
  }
}

function OrderSummary({ order }: { order: Enrollment }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-5" />
          {order.event.title}
        </CardTitle>
        <CardDescription className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-4 shrink-0" />
            {formatDateRange(order.event.startsAt, order.event.endsAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4 shrink-0" />
            {order.event.venue}
          </span>
        </CardDescription>
        <CardAction>
          <EnrollmentStatusBadge enrollment={order} className="items-end" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span>
            {order.ticketType.name} × {order.quantity}
          </span>
          <span className="font-semibold tabular-nums">{formatPrice(order.total)}</span>
        </div>
        {order.refunds.map((refund) => (
          <div key={refund.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2">
              <Undo2 className="size-4 text-muted-foreground" />
              คืนเงิน {refund.percent}%
              <RefundStatusBadge status={refund.status} />
              <span className="text-xs text-muted-foreground">{formatDateTime(refund.createdAt)}</span>
            </span>
            <span className="tabular-nums">−{formatBaht(refund.amount)}</span>
          </div>
        ))}
        <Separator />
        <ol className="flex flex-col gap-2" aria-label="ผู้เข้าร่วม">
          {order.tickets.map((ticket) => {
            const row = (
              <>
                <UserRound className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">
                    {ticket.firstName} {ticket.lastName}
                  </span>
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Mail className="size-3.5 shrink-0" />
                    {ticket.email}
                  </span>
                </span>
              </>
            );
            return (
              <li key={ticket.id}>
                {order.status === "confirmed" ? (
                  <Link
                    to="/tickets/$ticketId"
                    params={{ ticketId: ticket.id }}
                    className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-muted"
                  >
                    {row}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 py-1.5">{row}</div>
                )}
              </li>
            );
          })}
        </ol>
        <span className="text-xs text-muted-foreground">ลงทะเบียนเมื่อ {formatDateTime(order.createdAt)}</span>
      </CardContent>
    </Card>
  );
}

/** A confirmed paid order: what its refund policy gives back, and the button that cancels it for that. */
function RefundCard({ order }: { order: Enrollment }) {
  const terms = order.refundTerms;
  const open = terms !== null && isRefundOpen(terms);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Undo2 className="size-5" />
          การคืนเงิน
        </CardTitle>
        <CardDescription>
          {!terms
            ? "รายการนี้ไม่รับคืนเงิน"
            : open
              ? `ยกเลิกได้ถึง ${formatDateTime(terms.deadline)} และรับเงินคืน ${formatBaht(terms.amount)} (${terms.percent}% ของ ${formatPrice(order.total)})`
              : `เลยกำหนดขอคืนเงินแล้ว (ขอคืนได้ถึง ${formatDateTime(terms.deadline)})`}
        </CardDescription>
        {open && (
          <CardAction>
            <RefundButton order={order} terms={terms} />
          </CardAction>
        )}
      </CardHeader>
    </Card>
  );
}

function RefundButton({ order, terms }: { order: Enrollment; terms: NonNullable<Enrollment["refundTerms"]> }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const refund = useMutation({
    mutationFn: async () => {
      const { data, error } = await paymentClient.api.payment.refunds.post({ enrollmentId: order.id });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.add({
        type: "success",
        title: "ยกเลิกรายการแล้ว",
        description: `ระบบกำลังคืนเงิน ${formatBaht(data.amount)} และส่งอีเมลแจ้งผู้เข้าร่วมแล้ว`,
      });
      setOpen(false);
    },
    // e.g. the deadline passed meanwhile
    onError: (error) => toast.add({ type: "error", title: problemMessage(error) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: enrollmentsKey }),
  });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !refund.isPending && setOpen(next)}>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        <Undo2 data-icon="inline-start" />
        ขอคืนเงิน
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Undo2 />
          </AlertDialogMedia>
          <AlertDialogTitle>ยกเลิกและขอคืนเงิน?</AlertDialogTitle>
          <AlertDialogDescription>
            คุณจะได้รับเงินคืน {formatBaht(terms.amount)} ({terms.percent}% ของ {formatPrice(order.total)}) ตั๋วทั้ง{" "}
            {order.quantity} ใบจะถูกยกเลิกและใช้เช็กอินไม่ได้ ย้อนกลับไม่ได้
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={refund.isPending}>
            <ArrowLeft data-icon="inline-start" />
            กลับ
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={refund.isPending} onClick={() => refund.mutate()}>
            {refund.isPending ? <Spinner data-icon="inline-start" /> : <Undo2 data-icon="inline-start" />}
            ยกเลิกและคืนเงิน
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
