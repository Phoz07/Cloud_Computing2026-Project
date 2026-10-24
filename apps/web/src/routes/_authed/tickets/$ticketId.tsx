import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, CalendarClock, ExternalLink, Mail, MapPin, ReceiptText, ShoppingBag, TicketX, UserRound,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ticketQueryOptions } from "@/lib/enrollments";
import { hasEnded } from "@/lib/events";
import { formatDateRange } from "@/lib/format";
import { kindInfo } from "@/lib/ticket-types";

export const Route = createFileRoute("/_authed/tickets/$ticketId")({ component: TicketPage });

// black on white whatever the theme, so scanners read it
const QR = { level: "M", fgColor: "#0a0a0a", bgColor: "#ffffff" } as const;

function TicketPage() {
  const { ticketId } = Route.useParams();
  const { data: ticket, isPending, isError } = useQuery(ticketQueryOptions(ticketId));

  const back = (
    <Link to="/tickets" className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
      <ArrowLeft data-icon="inline-start" />
      ตั๋วของฉัน
    </Link>
  );

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-4" aria-busy="true" aria-label="กำลังโหลดตั๋ว">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[32rem]" />
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
          <EmptyTitle>ไม่พบตั๋วนี้</EmptyTitle>
          <EmptyDescription>ตั๋วจะแสดงกับบัญชีของผู้ซื้อ และบัญชีที่ใช้อีเมลเดียวกับผู้เข้าร่วมเท่านั้น</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{back}</EmptyContent>
      </Empty>
    );
  }

  const { event } = ticket;
  const { icon: KindIcon } = kindInfo[ticket.ticketType.kind];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 py-4">
      {back}
      <Card className="overflow-hidden pt-0">
        {event.thumbnailUrl && <img src={event.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />}
        <CardHeader className={event.thumbnailUrl ? undefined : "pt-6"}>
          <CardTitle className="text-xl">{event.title}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <KindIcon data-icon="inline-start" />
              {ticket.ticketType.name}
            </Badge>
            {hasEnded(event) && <Badge variant="outline">อีเวนต์นี้จบแล้ว</Badge>}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <div className="overflow-hidden rounded-2xl border">
            <QRCodeSVG value={ticket.code} size={232} marginSize={2} title={`QR Code ตั๋วของ ${ticket.firstName}`} {...QR} />
          </div>
          <span className="font-mono text-xl font-semibold tracking-[0.3em]">{ticket.code}</span>
          <span className="text-center text-sm text-muted-foreground">แสดง QR code นี้ที่จุดเช็กอินหน้างาน</span>
        </CardContent>
        <Separator />
        <CardContent>
          <dl className="flex flex-col gap-3 text-sm">
            <Detail icon={UserRound} label="ผู้เข้าร่วม">
              {ticket.firstName} {ticket.lastName}
            </Detail>
            <Detail icon={Mail} label="อีเมล">
              {ticket.email}
            </Detail>
            <Detail icon={CalendarClock} label="วันและเวลา">
              {formatDateRange(event.startsAt, event.endsAt)}
            </Detail>
            <Detail icon={MapPin} label="สถานที่">
              {event.venue}
            </Detail>
            {ticket.boughtBy && (
              <Detail icon={ShoppingBag} label="ซื้อโดย">
                {ticket.boughtBy.name}
              </Detail>
            )}
          </dl>
          {ticket.answers.length > 0 && (
            <dl className="mt-4 flex flex-col gap-2 rounded-2xl bg-muted px-4 py-3 text-sm">
              {ticket.answers.map((answer) => (
                <div key={answer.questionId} className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">{answer.label}</dt>
                  <dd className="break-words whitespace-pre-wrap">{answer.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2">
          {/* the order is where its buyer asks for a refund */}
          {ticket.isBuyer && (
            <Link
              to="/tickets/orders/$enrollmentId"
              params={{ enrollmentId: ticket.enrollmentId }}
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              <ReceiptText data-icon="inline-start" />
              ดูรายการสั่งซื้อ
            </Link>
          )}
          <Link to="/events/$slug" params={{ slug: event.slug }} className={buttonVariants({ variant: "outline", className: "w-full" })}>
            <ExternalLink data-icon="inline-start" />
            ดูหน้าอีเวนต์
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words">{children}</dd>
      </div>
    </div>
  );
}
