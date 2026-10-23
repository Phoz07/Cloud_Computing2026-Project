import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, Compass, History, Hourglass, MapPin, QrCode, Ticket } from "lucide-react";
import { EnrollmentStatusBadge } from "@/components/enrollment-status-badge";
import { PageHeader } from "@/components/page-header";
import { PayButton } from "@/components/pay-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { myTicketsQueryOptions, type Enrollment, type MyTicket } from "@/lib/enrollments";
import { hasEnded, isLive } from "@/lib/events";
import { formatDateRange, formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authed/tickets/")({ component: MyTicketsPage });

/** Tickets of one event, in order. */
type EventGroup = { event: MyTicket["event"]; tickets: MyTicket[] };

function groupByEvent(tickets: MyTicket[]) {
  const groups = new Map<string, EventGroup>();
  for (const ticket of tickets) {
    const group = groups.get(ticket.event.id) ?? { event: ticket.event, tickets: [] };
    group.tickets.push(ticket);
    groups.set(ticket.event.id, group);
  }
  return [...groups.values()];
}

function MyTicketsPage() {
  const { data, isPending } = useQuery(myTicketsQueryOptions);
  const groups = groupByEvent(data?.tickets ?? []);
  const upcoming = groups.filter((group) => !hasEnded(group.event));
  // most recent first
  const past = groups.filter((group) => hasEnded(group.event)).reverse();
  const orders = data?.orders ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-4">
      <PageHeader icon={Ticket} title="ตั๋วของฉัน" description="ตั๋วที่คุณซื้อ และตั๋วที่คนอื่นซื้อให้อีเมลของคุณ" />

      {isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="กำลังโหลดตั๋ว">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : orders.length === 0 && groups.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Ticket />
            </EmptyMedia>
            <EmptyTitle>ยังไม่มีตั๋ว</EmptyTitle>
            <EmptyDescription>
              ตั๋วที่คุณลงทะเบียน และตั๋วที่คนอื่นซื้อให้อีเมลของคุณจะแสดงที่นี่
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/events" className={buttonVariants()}>
              <Compass data-icon="inline-start" />
              สำรวจอีเวนต์
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {orders.length > 0 && (
            <Section icon={Hourglass} title="รอดำเนินการ">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </Section>
          )}
          <Section icon={CalendarClock} title="กำลังจะมาถึง">
            {upcoming.length ? (
              upcoming.map((group) => <EventTicketsCard key={group.event.id} group={group} />)
            ) : (
              <p className="text-sm text-muted-foreground">ยังไม่มีอีเวนต์ที่กำลังจะมาถึง</p>
            )}
          </Section>
          {past.length > 0 && (
            <Section icon={History} title="ผ่านไปแล้ว">
              {past.map((group) => (
                <EventTicketsCard key={group.event.id} group={group} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Ticket; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Icon className="size-5 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** An enrollment still waiting for the organizer or for payment. */
function OrderCard({ order }: { order: Enrollment }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="truncate">{order.event.title}</CardTitle>
        <CardDescription>
          {order.ticketType.name} × {order.quantity} · {formatPrice(order.total)}
        </CardDescription>
        <CardAction>
          <EnrollmentStatusBadge enrollment={order} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {order.status === "pending" ? "รอผู้จัดงานอนุมัติ เราจะแจ้งผลทางอีเมล" : "ชำระเงินเพื่อรับตั๋ว"}
        </span>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/tickets/orders/$enrollmentId"
            params={{ enrollmentId: order.id }}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            รายละเอียด
            <ChevronRight data-icon="inline-end" />
          </Link>
          {order.status === "awaiting_payment" && <PayButton enrollmentId={order.id} size="sm" />}
        </div>
      </CardContent>
    </Card>
  );
}

function EventTicketsCard({ group }: { group: EventGroup }) {
  const { event, tickets } = group;
  return (
    <Card className="overflow-hidden sm:flex-row sm:gap-0 sm:py-0">
      {event.thumbnailUrl && (
        <img
          src={event.thumbnailUrl}
          alt=""
          className="aspect-video w-full object-cover sm:my-6 sm:ml-6 sm:w-56 sm:shrink-0 sm:self-start sm:rounded-xl"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-4 sm:py-6">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Link to="/events/$slug" params={{ slug: event.slug }} className="min-w-0 truncate hover:underline">
              {event.title}
            </Link>
            {isLive(event) && <Badge>กำลังจัดอยู่ตอนนี้</Badge>}
          </CardTitle>
          <CardDescription className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-4 shrink-0" />
              {formatDateRange(event.startsAt, event.endsAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col">
            {tickets.map((ticket, index) => (
              <li key={ticket.id} className="flex flex-col">
                {index > 0 && <Separator className="my-2" />}
                <Link
                  to="/tickets/$ticketId"
                  params={{ ticketId: ticket.id }}
                  className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <QrCode className="size-5 shrink-0 text-primary" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {ticket.firstName} {ticket.lastName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {ticket.ticketType.name}
                      {ticket.boughtBy && ` · ซื้อโดย ${ticket.boughtBy.name}`}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </div>
    </Card>
  );
}
