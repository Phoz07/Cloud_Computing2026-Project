import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  LayoutDashboard,
  Megaphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { userCountQueryOptions } from "@/lib/admin-users";
import { pendingApplicationsQueryOptions } from "@/lib/organizer-applications";
import { hasRole, useSession } from "@/lib/session";
import { RecentEvents } from "./-components/recent-events";

export const Route = createFileRoute("/_authed/dashboard/")({ component: Overview });

function Overview() {
  const { data: session } = useSession();
  const isAdmin = hasRole(session?.user, ["admin"]);

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="ภาพรวม"
        description={session ? `สวัสดีคุณ ${session.user.name}` : undefined}
      />
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            icon={Users}
            label="ผู้ใช้ทั้งหมด"
            query={userCountQueryOptions()}
            to="/dashboard/users"
          />
          <StatCard
            icon={Megaphone}
            label="ผู้จัดงาน"
            query={userCountQueryOptions("organizer")}
            to="/dashboard/users"
          />
          <StatCard
            icon={ClipboardCheck}
            label="คำขอรอพิจารณา"
            query={{ ...pendingApplicationsQueryOptions, select: (list) => list.length }}
            to="/dashboard/applications"
          />
        </div>
      )}
      <RecentEvents title={isAdmin ? "อีเวนต์ล่าสุด" : "อีเวนต์ของฉัน"} />
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  query,
  to,
}: {
  icon: LucideIcon;
  label: string;
  query: UseQueryOptions<any, Error, number, any>;
  to: "/dashboard/users" | "/dashboard/applications";
}) {
  const { data, isPending } = useQuery(query);
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums">
          {isPending ? <Skeleton className="h-9 w-16" /> : (data ?? 0).toLocaleString("th-TH")}
        </CardTitle>
        <CardAction>
          <Link to={to} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={`ดู${label}`}>
            <ArrowRight />
          </Link>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
