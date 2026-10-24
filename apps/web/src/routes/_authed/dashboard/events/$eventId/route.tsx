import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Ban,
  CalendarCog,
  CalendarX,
  Copy,
  ExternalLink,
  MailCheck,
  PencilLine,
  ReceiptText,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { EventStatusBadge } from "@/components/event-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { eventQueryOptions, eventUrl, type EventDetail } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { hasRole, useSession } from "@/lib/session";

export const Route = createFileRoute("/_authed/dashboard/events/$eventId")({ component: EventLayout });

type Tab = {
  title: string;
  icon: LucideIcon;
  to:
    | "/dashboard/events/$eventId"
    | "/dashboard/events/$eventId/tickets"
    | "/dashboard/events/$eventId/invitations"
    | "/dashboard/events/$eventId/participants"
    | "/dashboard/events/$eventId/refunds";
};

const tabs: Tab[] = [
  { title: "รายละเอียด", to: "/dashboard/events/$eventId", icon: PencilLine },
  { title: "ตั๋ว", to: "/dashboard/events/$eventId/tickets", icon: Ticket },
  { title: "ผู้ได้รับเชิญ", to: "/dashboard/events/$eventId/invitations", icon: MailCheck },
  { title: "ผู้เข้าร่วม", to: "/dashboard/events/$eventId/participants", icon: Users },
  { title: "คืนเงิน", to: "/dashboard/events/$eventId/refunds", icon: ReceiptText },
];

function EventLayout() {
  const { eventId } = Route.useParams();
  const { data: event, isPending, isError } = useQuery(eventQueryOptions(eventId));

  if (isPending) return <LayoutSkeleton />;
  if (isError) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX />
          </EmptyMedia>
          <EmptyTitle>ไม่พบอีเวนต์นี้</EmptyTitle>
          <EmptyDescription>อีเวนต์อาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์แก้ไข</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/dashboard/events" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft data-icon="inline-start" />
            กลับไปรายการอีเวนต์
          </Link>
        </EmptyContent>
      </Empty>
    );
  }
  // tabs read the event with useEventDetail(), so they only mount once it has loaded
  return (
    <div className="flex flex-col gap-6">
      <EventHeader event={event} />
      <EventTabs eventId={event.id} />
      <SuspendedAlert event={event} />
      <Outlet />
    </div>
  );
}

function EventHeader({ event }: { event: EventDetail }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(eventUrl(event.slug));
      toast.add({ type: "success", title: "คัดลอกลิงก์แล้ว", description: eventUrl(event.slug) });
    } catch {
      toast.add({ type: "error", title: "คัดลอกไม่สำเร็จ" });
    }
  }

  return (
    <header className="flex flex-col gap-3">
      <Link to="/dashboard/events" className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
        <ArrowLeft data-icon="inline-start" />
        อีเวนต์ทั้งหมด
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold">
            <CalendarCog className="size-6 shrink-0 text-primary" />
            <span className="truncate">{event.title}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <EventStatusBadge status={event.status} publishAt={event.publishAt} />
            <span>แก้ไขล่าสุด {formatDateTime(event.updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={copyLink}>
            <Copy data-icon="inline-start" />
            คัดลอกลิงก์
          </Button>
          <Link
            to="/events/$slug"
            params={{ slug: event.slug }}
            target="_blank"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink data-icon="inline-start" />
            ดูหน้าอีเวนต์
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * One tab per route under the event; the URL picks the active one, so leaving unsaved edits still asks first.
 * Tabs with pages under them (e.g. tickets/new) stay active there; the details tab is the index, so only exactly.
 */
function EventTabs({ eventId }: { eventId: string }) {
  const matchRoute = useMatchRoute();
  const current = tabs.find((tab) => matchRoute({ to: tab.to, fuzzy: tab.to !== "/dashboard/events/$eventId" }))?.to;

  return (
    // scrolls sideways on narrow screens; the bottom padding keeps the active underline inside the scroll box
    <nav aria-label="เมนูอีเวนต์" className="-mt-2 overflow-x-auto pb-1">
      <Tabs value={current}>
        <TabsList variant="line">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.to}
              value={tab.to}
              nativeButton={false}
              render={<Link to={tab.to} params={{ eventId }} />}
            >
              <tab.icon data-icon="inline-start" />
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}

function SuspendedAlert({ event }: { event: EventDetail }) {
  const { data: session } = useSession();
  if (event.status !== "suspended") return null;
  return (
    <Alert variant="destructive">
      <Ban />
      <AlertTitle>อีเวนต์นี้ถูกระงับ</AlertTitle>
      <AlertDescription>
        {hasRole(session?.user, ["admin"])
          ? "อีเวนต์ถูกซ่อนจากทุกคน ยกเลิกการระงับได้ที่การ์ด “การกำกับดูแล” ในแท็บรายละเอียด หรือเลือกสถานะใหม่แล้วบันทึก"
          : "ผู้ดูแลระบบระงับอีเวนต์นี้ อีเวนต์ถูกซ่อนจากทุกคน และคุณแก้ไขไม่ได้จนกว่าจะยกเลิกการระงับ"}
      </AlertDescription>
    </Alert>
  );
}

function LayoutSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="กำลังโหลดอีเวนต์">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
          <Skeleton className="h-96" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-56" />
        </div>
      </div>
    </div>
  );
}
