import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ClipboardCheck, Inbox, ListFilter } from "lucide-react";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/page-header";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { applicationsQueryOptions, type ApplicationStatus } from "@/lib/organizer-applications";
import { hasRole } from "@/lib/session";
import { applicationColumns, statusBadges } from "./-components/applications-columns";

const filters = ["pending", "approved", "rejected", "all"] as const;

export const Route = createFileRoute("/_authed/dashboard/applications")({
  validateSearch: z.object({ status: z.enum(filters).optional() }),
  beforeLoad: ({ context }) => {
    if (!hasRole(context.session.user, ["admin"])) throw redirect({ to: "/dashboard" });
  },
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const navigate = Route.useNavigate();
  const status = Route.useSearch({ select: (search) => search.status ?? "pending" });
  const { data, isPending } = useQuery(
    applicationsQueryOptions(status === "all" ? undefined : (status as ApplicationStatus)),
  );

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        title="คำขอเป็นผู้จัดงาน"
        description="อนุมัติเพื่อเปลี่ยนบทบาทผู้ใช้เป็นผู้จัดงาน หรือปฏิเสธพร้อมหมายเหตุ"
        actions={
          <ToggleGroup
            variant="outline"
            value={[status]}
            onValueChange={(value: string[]) =>
              value[0] && navigate({ search: { status: value[0] as (typeof filters)[number] } })
            }
          >
            {filters.map((filter) => {
              const Icon = filter === "all" ? ListFilter : statusBadges[filter].icon;
              return (
                <ToggleGroupItem key={filter} value={filter}>
                  <Icon />
                  {filter === "all" ? "ทั้งหมด" : statusBadges[filter].label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        }
      />
      <DataTable
        columns={applicationColumns}
        data={data ?? []}
        isLoading={isPending}
        empty={{
          icon: Inbox,
          title: status === "pending" ? "ไม่มีคำขอที่รอพิจารณา" : "ไม่มีคำขอ",
        }}
      />
    </>
  );
}
