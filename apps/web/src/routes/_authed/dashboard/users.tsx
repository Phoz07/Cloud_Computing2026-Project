import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Search, UserRoundSearch, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { PageHeader } from "@/components/page-header";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usersQueryOptions } from "@/lib/admin-users";
import { hasRole, useSession } from "@/lib/session";
import { userColumns } from "./-components/users-columns";

export const Route = createFileRoute("/_authed/dashboard/users")({
  beforeLoad: ({ context }) => {
    if (!hasRole(context.session.user, ["admin"])) throw redirect({ to: "/dashboard" });
  },
  component: UsersPage,
});

function UsersPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const { data, isPending } = useQuery(usersQueryOptions({ ...pagination, search: debouncedSearch }));
  const columns = useMemo(() => userColumns(session?.user.id), [session?.user.id]);

  return (
    <>
      <PageHeader
        icon={Users}
        title="ผู้ใช้"
        description="เปลี่ยนบทบาท ระงับ หรือยกเลิกการระงับบัญชีผู้ใช้"
        actions={
          <InputGroup className="w-full sm:w-72">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="ค้นหาด้วยอีเมล"
              aria-label="ค้นหาผู้ใช้ด้วยอีเมล"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((current) => ({ ...current, pageIndex: 0 }));
              }}
            />
          </InputGroup>
        }
      />
      <DataTable
        columns={columns}
        data={data?.users ?? []}
        isLoading={isPending}
        empty={{
          icon: UserRoundSearch,
          title: "ไม่พบผู้ใช้",
          description: debouncedSearch ? `ไม่มีผู้ใช้ที่อีเมลตรงกับ “${debouncedSearch}”` : undefined,
        }}
        pagination={{ state: pagination, onChange: setPagination, rowCount: data?.total ?? 0 }}
      />
    </>
  );
}
