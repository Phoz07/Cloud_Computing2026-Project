import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, CalendarDays, Megaphone } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { publicEventsQueryOptions } from "@/lib/events";
import { formatDateRange } from "@/lib/format";
import { organizerQueryOptions } from "@/lib/organizers";

const monthYear = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

/** "จัดโดย …" under the event title; jumps to the organizer section further down. */
export function OrganizerByline({ organizerId }: { organizerId: string }) {
  const { data: organizer, isPending } = useQuery(organizerQueryOptions(organizerId));
  if (isPending) return <Skeleton className="h-8 w-48" />;
  if (!organizer) return null;
  return (
    <a
      href="#organizer"
      className="flex w-fit items-center gap-2 rounded-full text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <UserAvatar user={organizer} size="sm" />
      <span>
        จัดโดย <span className="font-medium text-foreground">{organizer.name}</span>
      </span>
    </a>
  );
}

const OTHERS = 3;

/** Who organizes the event, and what else they have coming up. */
export function OrganizerSection({ organizerId, eventId }: { organizerId: string; eventId: string }) {
  const { data: organizer, isPending } = useQuery(organizerQueryOptions(organizerId));
  // one more than shown, in case this event is among them
  const { data: upcoming } = useQuery(publicEventsQueryOptions({ organizerId, pageSize: OTHERS + 1 }));
  const others = (upcoming?.items ?? []).filter((event) => event.id !== eventId).slice(0, OTHERS);

  if (isPending) return <Skeleton className="h-24" />;
  if (!organizer) return null;

  return (
    <section id="organizer" className="flex scroll-mt-24 flex-col gap-4" aria-labelledby="organizer-heading">
      <h2 id="organizer-heading" className="flex items-center gap-2 text-xl font-bold">
        <Megaphone className="size-5 text-primary" />
        ผู้จัดงาน
      </h2>
      <Card>
        <CardContent className="flex flex-col gap-6">
          {/* phones: the button drops below, so the name keeps the full width */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <UserAvatar user={organizer} className="size-14 shrink-0 text-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex items-center gap-1.5 text-lg font-semibold">
                  <span className="truncate">{organizer.name}</span>
                  {organizer.organizerSince && (
                    <BadgeCheck className="size-5 shrink-0 text-primary" aria-label="ผู้จัดงานที่ผ่านการอนุมัติ" />
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {organizer.organizerSince
                    ? `ผู้จัดงานบน Eventide ตั้งแต่ ${monthYear.format(new Date(organizer.organizerSince))}`
                    : "ผู้จัดงานบน Eventide"}
                  {upcoming && upcoming.total > 0 && ` · อีเวนต์ที่กำลังจะมาถึง ${upcoming.total} รายการ`}
                </p>
              </div>
            </div>
            {/* only worth a link when there's more than this event */}
            {others.length > 0 && (
              <Link
                to="/events"
                search={{ organizer: organizer.id }}
                className={buttonVariants({ variant: "outline", size: "sm", className: "self-start sm:self-auto" })}
              >
                ดูอีเวนต์ทั้งหมด
                <ArrowRight data-icon="inline-end" />
              </Link>
            )}
          </div>

          {others.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">อีเวนต์อื่นจากผู้จัดงานนี้</h3>
              <ul className="flex flex-col divide-y">
                {others.map((event) => (
                  <li key={event.id}>
                    <Link
                      to="/events/$slug"
                      params={{ slug: event.slug }}
                      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted"
                    >
                      <div className="flex aspect-video w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                        {event.thumbnailUrl ? (
                          <img src={event.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <CalendarDays className="size-4" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{event.title}</span>
                        <span className="truncate text-sm text-muted-foreground">
                          {formatDateRange(event.startsAt, event.endsAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
