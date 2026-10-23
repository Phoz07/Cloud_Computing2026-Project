import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, CalendarClock, ChevronRight, CircleCheckBig, CircleX, Clock, CreditCard, Hourglass, Mail, MapPin, QrCode,
  ReceiptText, TicketX, UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { EnrollmentStatusBadge } from "@/components/enrollment-status-badge";
import { PayButton } from "@/components/pay-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { enrollmentQueryOptions, type Enrollment } from "@/lib/enrollments";
import { formatDateRange, formatDateTime, formatPrice } from "@/lib/format";

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
          actions: <PayButton enrollmentId={order.id} />,
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
          <EnrollmentStatusBadge enrollment={order} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span>
            {order.ticketType.name} × {order.quantity}
          </span>
          <span className="font-semibold tabular-nums">{formatPrice(order.total)}</span>
        </div>
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
