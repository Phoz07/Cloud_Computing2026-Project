import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { isLive, type EventSummary } from "@/lib/events";
import { formatDateRange } from "@/lib/format";

const day = new Intl.DateTimeFormat("th-TH", { day: "numeric" });
const month = new Intl.DateTimeFormat("th-TH", { month: "short" });

export function EventCard({ event }: { event: EventSummary }) {
  return (
    <Link
      to="/events/$slug"
      params={{ slug: event.slug }}
      className="group rounded-3xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="h-full overflow-hidden pt-0 transition-shadow group-hover:shadow-lg">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
          {event.thumbnailUrl ? (
            <img
              src={event.thumbnailUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <CalendarDays className="size-10" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex size-14 flex-col items-center justify-center rounded-2xl bg-background/95 shadow-sm">
            <span className="text-lg leading-none font-bold">{day.format(new Date(event.startsAt))}</span>
            <span className="text-xs text-muted-foreground">{month.format(new Date(event.startsAt))}</span>
          </div>
          {isLive(event) && (
            <Badge className="absolute top-3 right-3">
              <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" />
              กำลังจัด
            </Badge>
          )}
        </div>
        <CardContent className="flex flex-col gap-2">
          <Badge variant="secondary" className="self-start">
            <Tag data-icon="inline-start" />
            {event.category.name}
          </Badge>
          <h2 className="line-clamp-2 text-lg font-bold group-hover:underline">{event.title}</h2>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CalendarDays className="mt-0.5 size-4 shrink-0" />
            {formatDateRange(event.startsAt, event.endsAt)}
          </p>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span className="line-clamp-1">{event.venue}</span>
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
