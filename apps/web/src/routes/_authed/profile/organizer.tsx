import { createFileRoute, redirect } from "@tanstack/react-router";
import { CalendarPlus } from "lucide-react";
import { OrganizerApplication } from "@/components/organizer-application";
import { Section } from "./-components/section";

export const Route = createFileRoute("/_authed/profile/organizer")({
  // admins already manage organizers, so there is nothing to apply for
  beforeLoad: ({ context }) => {
    if (context.session.user.role === "admin") throw redirect({ to: "/profile" });
  },
  component: OrganizerPage,
});

function OrganizerPage() {
  return (
    <Section
      icon={CalendarPlus}
      title="สมัครเป็นผู้จัดงาน"
      description="ผู้จัดงานสร้างอีเวนต์ ขายตั๋ว และเช็คอินผู้เข้าร่วมได้"
    >
      <OrganizerApplication />
    </Section>
  );
}
