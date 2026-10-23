import { Link } from "@tanstack/react-router";
import { CalendarPlus, CalendarX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function NoEventsYet() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarX />
        </EmptyMedia>
        <EmptyTitle>ยังไม่มีอีเวนต์</EmptyTitle>
        <EmptyDescription>เริ่มต้นด้วยการสร้างอีเวนต์แรกของคุณ</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/dashboard/events/new" className={buttonVariants()}>
          <CalendarPlus data-icon="inline-start" />
          สร้างอีเวนต์
        </Link>
      </EmptyContent>
    </Empty>
  );
}
