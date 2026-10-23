import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NoEventsYet } from "./-components/no-events-yet";

export const Route = createFileRoute("/_authed/dashboard/events")({ component: EventsPage });

function EventsPage() {
  return (
    <>
      <PageHeader
        icon={CalendarDays}
        title="อีเวนต์ของฉัน"
        description="สร้างและจัดการอีเวนต์ ประเภทตั๋ว และแบบฟอร์มลงทะเบียน"
        actions={
          <Button disabled>
            <CalendarPlus data-icon="inline-start" />
            สร้างอีเวนต์ (เร็วๆ นี้)
          </Button>
        }
      />
      <Card>
        <CardContent>
          <NoEventsYet />
        </CardContent>
      </Card>
    </>
  );
}
