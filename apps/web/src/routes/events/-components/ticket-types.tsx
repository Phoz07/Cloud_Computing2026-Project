import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Ban, CircleCheckBig, LogIn, MailCheck, Ticket, TicketCheck, TicketX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { availabilityQueryOptions, type Availability } from "@/lib/enrollments";
import { hasEnded, type EventDetail } from "@/lib/events";
import { formatPrice } from "@/lib/format";
import { useLiveSeats } from "@/lib/live-seats";
import { useSession } from "@/lib/session";
import { kindInfo, ticketTypesQueryOptions, type TicketType } from "@/lib/ticket-types";

/** The event page's ticket list: price, seats left, and what the viewer can do with each type. */
export function EventTickets({ event }: { event: EventDetail }) {
  const { data: types, isPending } = useQuery(ticketTypesQueryOptions(event.id));
  const { data: availability } = useQuery(availabilityQueryOptions(event.id));
  useLiveSeats(event.id);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="tickets">
      <h2 id="tickets" className="flex items-center gap-2 text-xl font-bold">
        <Ticket className="size-5 text-primary" />
        ตั๋ว
      </h2>
      {isPending ? (
        <Skeleton className="h-32" />
      ) : !types?.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TicketX />
            </EmptyMedia>
            <EmptyTitle>ยังไม่เปิดลงทะเบียน</EmptyTitle>
            <EmptyDescription>ผู้จัดงานยังไม่ได้เพิ่มตั๋วของอีเวนต์นี้</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {types.map((type) => (
            <TicketOption
              key={type.id}
              event={event}
              ticketType={type}
              availability={availability?.find((a) => a.ticketTypeId === type.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TicketOption({
  event,
  ticketType,
  availability,
}: {
  event: EventDetail;
  ticketType: TicketType;
  availability: Availability | undefined;
}) {
  const { icon: KindIcon, label } = kindInfo[ticketType.kind];
  const remaining = availability?.remaining;
  // not counted in `remaining`; they come back if the payment doesn't arrive in time
  const reserved = availability?.reserved ?? 0;

  return (
    <li className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{ticketType.name}</span>
          {ticketType.kind !== "first_come" && (
            <Badge variant="secondary">
              <KindIcon data-icon="inline-start" />
              {label}
            </Badge>
          )}
        </div>
        <span className="text-lg font-bold text-primary">{formatPrice(ticketType.price)}</span>
        {ticketType.description && (
          <p className="text-sm whitespace-pre-line text-muted-foreground">{ticketType.description}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {remaining != null && (remaining > 0 || reserved > 0) && (
            <span>
              {remaining > 0
                ? `เหลือ ${remaining.toLocaleString()} ใบ${reserved > 0 ? ` (อีก ${reserved.toLocaleString()} ใบรอชำระเงิน)` : ""}`
                : `${reserved.toLocaleString()} ใบรอชำระเงิน อาจว่างอีกครั้งหากชำระไม่ทัน`}
            </span>
          )}
          <span>สูงสุด {ticketType.maxPerUser} ใบต่อบัญชี</span>
          {!!availability?.mine && (
            <Link to="/tickets" className="flex items-center gap-1 text-primary underline-offset-4 hover:underline">
              <CircleCheckBig className="size-3.5" />
              คุณมี {availability.mine} ใบแล้ว
            </Link>
          )}
        </div>
      </div>
      <TicketAction event={event} ticketType={ticketType} availability={availability} />
    </li>
  );
}

/** The one thing the viewer can do with a ticket type right now, or why they can't. */
function TicketAction({
  event,
  ticketType,
  availability,
}: {
  event: EventDetail;
  ticketType: TicketType;
  availability: Availability | undefined;
}) {
  const { data: session } = useSession();
  const disabled = (icon: React.ReactNode, text: string) => (
    <Button variant="outline" disabled className="sm:w-48">
      {icon}
      {text}
    </Button>
  );

  switch (availability?.state) {
    case undefined:
      return <Skeleton className="h-9 sm:w-48" />;
    case "sold_out":
      return disabled(<TicketX data-icon="inline-start" />, "ตั๋วหมดแล้ว");
    case "limit_reached":
      return disabled(<TicketCheck data-icon="inline-start" />, "ครบจำนวนต่อบัญชีแล้ว");
    case "invitation_used":
      return disabled(<MailCheck data-icon="inline-start" />, "ใช้คำเชิญแล้ว");
    case "closed":
      return disabled(<Ban data-icon="inline-start" />, hasEnded(event) ? "ปิดรับลงทะเบียนแล้ว" : "ยังไม่เปิดลงทะเบียน");
    case "invite_only":
      // signed out, they may well be invited: signing in tells
      return session ? (
        disabled(<MailCheck data-icon="inline-start" />, "เฉพาะผู้ได้รับเชิญ")
      ) : (
        <Link
          to="/login"
          search={{ redirect: `/events/${event.slug}` }}
          className={buttonVariants({ variant: "outline", className: "sm:w-48" })}
        >
          <LogIn data-icon="inline-start" />
          เข้าสู่ระบบเพื่อรับคำเชิญ
        </Link>
      );
    case "open":
      return (
        <Link
          to="/events/$slug/enroll/$ticketTypeId"
          params={{ slug: event.slug, ticketTypeId: ticketType.id }}
          className={buttonVariants({ className: "sm:w-48" })}
        >
          {/* seats held on another visit or device: the enroll page carries on with them */}
          {availability.hold
            ? "กรอกข้อมูลต่อ"
            : ticketType.kind === "approval"
              ? "ขอเข้าร่วม"
              : ticketType.price > 0
                ? "ซื้อตั๋ว"
                : "ลงทะเบียน"}
          <ArrowRight data-icon="inline-end" />
        </Link>
      );
  }
}
