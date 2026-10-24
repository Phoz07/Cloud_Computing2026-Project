import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarClock,
  CalendarX,
  ExternalLink,
  Eye,
  FileText,
  LogIn,
  MailCheck,
  MapPin,
  Pencil,
  Receipt,
  Tag,
  UserPlus,
} from "lucide-react";
import { EventStatusBadge } from "@/components/event-status-badge";
import { ShareEvent } from "@/components/share-event";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { eventQueryOptions, eventUrl, hasEnded, isLive, isScheduled, problemCode, statusInfo } from "@/lib/events";
import { formatDateRange, formatDateTime, formatDuration } from "@/lib/format";
import { hasRole, useSession } from "@/lib/session";
import { OrganizerByline, OrganizerSection } from "./-components/organizer";
import { EventTickets } from "./-components/ticket-types";

export const Route = createFileRoute("/events/$slug")({ component: EventPage });

function EventPage() {
  const { slug } = Route.useParams();
  const { data: event, isPending, isError, error } = useQuery(eventQueryOptions(slug));
  const { data: session } = useSession();
  usePageTitle(event?.title);

  if (isPending) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-4" aria-busy="true">
        <Skeleton className="aspect-[21/9] w-full rounded-3xl" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (isError) {
    if (problemCode(error) === "INVITE_ONLY") return <InviteOnly slug={slug} email={session?.user.email} />;
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX />
          </EmptyMedia>
          <EmptyTitle>ไม่พบอีเวนต์นี้</EmptyTitle>
          <EmptyDescription>ลิงก์อาจไม่ถูกต้อง อีเวนต์อาจยังไม่เผยแพร่ หรือถูกลบไปแล้ว</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/events" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft data-icon="inline-start" />
            ไปหน้าสำรวจอีเวนต์
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  const user = session?.user;
  const canEdit = !!user && (user.id === event.organizerId || hasRole(user, ["admin"]));
  const preview = event.status !== "public" || isScheduled(event);
  const length = new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime();

  // only the organizer, admins and (for invite-only) invitees reach a page that isn't public; tell them who else can open the link
  const shareNotice =
    event.status === "draft"
      ? "อีเวนต์ยังเป็นฉบับร่าง คนอื่นจะเปิดลิงก์ได้เมื่อเผยแพร่แล้ว"
      : event.status === "invite"
        ? "อีเวนต์นี้เปิดให้เฉพาะผู้ได้รับเชิญ ผู้ที่ไม่ได้รับเชิญจะเปิดลิงก์ไม่ได้"
        : event.status === "suspended"
          ? "อีเวนต์ถูกระงับ คนอื่นจะเปิดลิงก์ไม่ได้จนกว่าจะยกเลิกการระงับ"
          : isScheduled(event) && event.publishAt
          ? `คนอื่นจะเปิดลิงก์ได้ตั้งแต่ ${formatDateTime(event.publishAt)}`
          : undefined;

  return (
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-4">
      <Link to="/events" className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
        <ArrowLeft data-icon="inline-start" />
        สำรวจอีเวนต์
      </Link>

      {/* an invitee also opens an invite-only event; they get a welcome instead of the editor's status */}
      {!canEdit && event.status === "invite" && (
        <Alert>
          <MailCheck />
          <AlertTitle>คุณได้รับเชิญเข้าร่วมอีเวนต์นี้</AlertTitle>
          <AlertDescription>อีเวนต์นี้ไม่แสดงในหน้าสำรวจ และเปิดได้เฉพาะผู้ได้รับเชิญ</AlertDescription>
        </Alert>
      )}
      {canEdit && (
        <Alert>
          <Eye />
          <AlertTitle>
            {preview ? "ตัวอย่าง: คนทั่วไปยังไม่เห็นหน้านี้" : `สถานะ: ${statusInfo[event.status].label}`}
          </AlertTitle>
          <AlertDescription>
            {event.status === "suspended"
              ? statusInfo.suspended.description
              : isScheduled(event) && event.publishAt
                ? `จะเผยแพร่ ${formatDateTime(event.publishAt)}`
                : statusInfo[event.status].description}
          </AlertDescription>
          {canEdit && (
            <AlertAction>
              <Link
                to="/dashboard/events/$eventId"
                params={{ eventId: event.id }}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Pencil data-icon="inline-start" />
                แก้ไข
              </Link>
            </AlertAction>
          )}
        </Alert>
      )}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <Tag data-icon="inline-start" />
            {event.category.name}
          </Badge>
          {isLive(event) && <Badge>กำลังจัดอยู่ตอนนี้</Badge>}
          {hasEnded(event) && <Badge variant="outline">อีเวนต์นี้จบแล้ว</Badge>}
          {preview && <EventStatusBadge status={event.status} publishAt={event.publishAt} />}
        </div>
        <h1 className="text-3xl font-bold text-balance sm:text-4xl">{event.title}</h1>
        <OrganizerByline organizerId={event.organizerId} />
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <EventTickets event={event} />

          {event.description ? (
            <section className="flex flex-col gap-3" aria-labelledby="about">
              <h2 id="about" className="flex items-center gap-2 text-xl font-bold">
                <FileText className="size-5 text-primary" />
                เกี่ยวกับอีเวนต์
              </h2>
              {/* sanitized by the event service on write (apps/event/src/libs/sanitize.ts) */}
              <div className="rich-text" dangerouslySetInnerHTML={{ __html: event.description }} />
            </section>
          ) : (
            <p className="text-muted-foreground">ผู้จัดงานยังไม่ได้เพิ่มรายละเอียด</p>
          )}

          <OrganizerSection organizerId={event.organizerId} eventId={event.id} />
        </div>

        {/* phones: the cover and the when/where come before the long description */}
        <aside className="order-first flex flex-col gap-4 lg:sticky lg:top-21 lg:order-none">
          <Card>
            {event.thumbnailUrl && <img src={event.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />}
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-5 text-primary" />
                วันและเวลา
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <p className="font-medium">{formatDateRange(event.startsAt, event.endsAt)}</p>
              {length > 0 && <p className="text-muted-foreground">ระยะเวลา {formatDuration(length)}</p>}
            </CardContent>
            <Separator />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5 text-primary" />
                สถานที่
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="font-medium">{event.venue}</p>
              {event.venueDescription && (
                <p className="whitespace-pre-line text-muted-foreground">{event.venueDescription}</p>
              )}
              {event.venueUrl && (
                <a
                  href={event.venueUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
                >
                  <ExternalLink data-icon="inline-start" />
                  เปิดแผนที่
                </a>
              )}
            </CardContent>
            <Separator />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="size-5 text-primary" />
                การคืนเงิน
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {event.isRefundAvailable && event.refundCutoffHours !== null && event.refundPercent !== null
                ? `คืนเงิน ${event.refundPercent}% เมื่อขอคืนก่อนงานเริ่มอย่างน้อย ${formatDuration(event.refundCutoffHours * 3_600_000)}`
                : "อีเวนต์นี้ไม่รับคืนเงิน"}
            </CardContent>
          </Card>
          <ShareEvent title={event.title} url={eventUrl(event.slug)} slug={event.slug} notice={shareNotice} />
        </aside>
      </div>
    </article>
  );
}

/** An invite-only event the viewer isn't invited to (or can't tell yet, signed out). The service reveals nothing else. */
function InviteOnly({ slug, email }: { slug: string; email: string | undefined }) {
  const redirect = `/events/${slug}`;
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MailCheck />
        </EmptyMedia>
        <EmptyTitle>อีเวนต์นี้เปิดให้เฉพาะผู้ได้รับเชิญ</EmptyTitle>
        <EmptyDescription>
          {email
            ? `คุณเข้าสู่ระบบด้วย ${email} ซึ่งไม่ได้รับเชิญ หากได้รับเชิญด้วยอีเมลอื่น กรุณาเข้าสู่ระบบด้วยอีเมลนั้น`
            : "หากคุณได้รับเชิญ กรุณาเข้าสู่ระบบ หรือสมัครสมาชิกด้วยอีเมลที่ได้รับเชิญ"}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        {email ? (
          <Link to="/events" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft data-icon="inline-start" />
            ไปหน้าสำรวจอีเวนต์
          </Link>
        ) : (
          <>
            <Link to="/login" search={{ redirect }} className={buttonVariants()}>
              <LogIn data-icon="inline-start" />
              เข้าสู่ระบบ
            </Link>
            <Link to="/register" search={{ redirect }} className={buttonVariants({ variant: "outline" })}>
              <UserPlus data-icon="inline-start" />
              สมัครสมาชิก
            </Link>
          </>
        )}
      </EmptyContent>
    </Empty>
  );
}
