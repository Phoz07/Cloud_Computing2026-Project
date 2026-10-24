import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays } from "lucide-react";
import { EventStatusBadge } from "@/components/event-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { myEventsQueryOptions } from "@/lib/events";
import { formatDateRange } from "@/lib/format";
import { NoEventsYet } from "./no-events-yet";

/** The five most recently edited events, or the first-event prompt. */
export function RecentEvents({ title }: { title: string }) {
  const { data, isPending } = useQuery(myEventsQueryOptions({ page: 1, pageSize: 5 }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>แก้ไขล่าสุด</CardDescription>
        {!!data?.total && (
          <CardAction>
            <Link to="/dashboard/events" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              ดูทั้งหมด ({data.total})
              <ArrowRight data-icon="inline-end" />
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <NoEventsYet />
        ) : (
          <ul className="flex flex-col divide-y">
            {data.items.map((event) => (
              <li key={event.id}>
                <Link
                  to="/dashboard/events/$eventId"
                  params={{ eventId: event.id }}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted"
                >
                  <div className="flex aspect-video w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                    {event.thumbnailUrl ? (
                      <img src={event.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <CalendarDays className="size-4" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{event.title}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {formatDateRange(event.startsAt, event.endsAt)}
                    </span>
                  </div>
                  <EventStatusBadge status={event.status} publishAt={event.publishAt} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
