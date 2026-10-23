import { CalendarPlus, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Placeholder until the event service has CRUD; organizers will only see their own events.
export function NoEventsYet() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarX />
        </EmptyMedia>
        <EmptyTitle>ยังไม่มีอีเวนต์</EmptyTitle>
        <EmptyDescription>ระบบสร้างอีเวนต์กำลังจะมาเร็วๆ นี้</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button disabled>
          <CalendarPlus data-icon="inline-start" />
          สร้างอีเวนต์ (เร็วๆ นี้)
        </Button>
      </EmptyContent>
    </Empty>
  );
}
