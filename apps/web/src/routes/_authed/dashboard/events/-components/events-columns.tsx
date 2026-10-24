import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { CalendarDays, Copy, ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { DataTableFeatures } from "@/components/data-table/data-table-features";
import { EventStatusBadge } from "@/components/event-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { eventUrl, hasEnded, isLive, type EventSummary } from "@/lib/events";
import { formatLongDate, formatTime } from "@/lib/format";
import { DeleteEventDialog } from "./delete-event-dialog";

const columnHelper = createColumnHelper<DataTableFeatures, EventSummary>();

/** `canModerate`: admins may still delete suspended events; organizers can't touch them. */
export const eventColumns = (canModerate: boolean) =>
  columnHelper.columns([
    columnHelper.display({
      id: "event",
      header: "อีเวนต์",
      cell: ({ row }) => {
        const event = row.original;
        return (
          <div className="flex min-w-56 items-center gap-3">
            <div className="flex aspect-video w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
              {event.thumbnailUrl ? (
                <img src={event.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
              ) : (
                <CalendarDays className="size-5" />
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <Link
                to="/dashboard/events/$eventId"
                params={{ eventId: event.id }}
                className="truncate font-medium hover:underline"
              >
                {event.title}
              </Link>
              <span className="truncate text-sm text-muted-foreground">{event.category.name}</span>
            </div>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "schedule",
      header: "วันจัดงาน",
      cell: ({ row }) => {
        const event = row.original;
        return (
          <div className="flex flex-col gap-1 whitespace-nowrap">
            <span>{formatLongDate(event.startsAt)}</span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {formatTime(event.startsAt)}–{formatTime(event.endsAt)} น.
              {isLive(event) ? (
                <Badge variant="default">กำลังจัด</Badge>
              ) : hasEnded(event) ? (
                <Badge variant="secondary">จบแล้ว</Badge>
              ) : null}
            </span>
          </div>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: "สถานะ",
      cell: ({ row }) => <EventStatusBadge status={row.original.status} publishAt={row.original.publishAt} />,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">จัดการ</span>,
      cell: ({ row }) => <EventRowActions event={row.original} canModerate={canModerate} />,
    }),
  ]);

function EventRowActions({ event, canModerate }: { event: EventSummary; canModerate: boolean }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const frozen = event.status === "suspended" && !canModerate;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(eventUrl(event.slug));
      toast.add({ type: "success", title: "คัดลอกลิงก์แล้ว" });
    } catch {
      toast.add({ type: "error", title: "คัดลอกไม่สำเร็จ" });
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />} aria-label={`จัดการ ${event.title}`}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link to="/dashboard/events/$eventId" params={{ eventId: event.id }} />}>
              <Pencil />
              {frozen ? "ดูรายละเอียด" : "แก้ไข"}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/events/$slug" params={{ slug: event.slug }} target="_blank" />}>
              <ExternalLink />
              ดูหน้าอีเวนต์
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyLink}>
              <Copy />
              คัดลอกลิงก์
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" disabled={frozen} onClick={() => setDeleteOpen(true)}>
              <Trash2 />
              ลบ
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteEventDialog event={event} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
