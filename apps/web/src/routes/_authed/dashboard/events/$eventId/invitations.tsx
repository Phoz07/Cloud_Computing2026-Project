import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CircleCheckBig, CircleDashed, ListFilter, MailCheck, MailPlus, PencilLine, Search, SearchX, TriangleAlert, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { statusInfo } from "@/lib/events";
import { invitationsQueryOptions, type InvitationStatus } from "@/lib/invitations";
import { hasRole, useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { InviteDialog } from "./-components/invitation-dialogs";
import { invitationColumns } from "./-components/invitations-columns";
import { useEventDetail } from "./-components/use-event-detail";

const PAGE_SIZE = 10;

const statusFilters = [
  { value: "unused", label: "ยังไม่ใช้", icon: CircleDashed },
  { value: "used", label: "ใช้แล้ว", icon: CircleCheckBig },
] as const;

// filters live in the URL, like the events list
export const Route = createFileRoute("/_authed/dashboard/events/$eventId/invitations")({
  validateSearch: z.object({
    status: z.enum(["used", "unused"]).optional(),
    q: z.string().optional(),
    page: z.number().int().min(1).optional(),
  }),
  component: InvitationsTab,
});

function InvitationsTab() {
  const event = useEventDetail();
  const { data: session } = useSession();
  // a suspended event is frozen for its organizer until an admin lifts it
  const locked = event.status === "suspended" && !hasRole(session?.user, ["admin"]);
  const navigate = Route.useNavigate();
  const { status, q = "", page = 1 } = Route.useSearch();
  const [search, setSearch] = useState(q);
  const debouncedSearch = useDebouncedValue(search.trim());
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (debouncedSearch !== q) {
      void navigate({ search: (prev) => ({ ...prev, q: debouncedSearch || undefined, page: undefined }), replace: true });
    }
  }, [debouncedSearch, q, navigate]);

  const { data, isPending, isPlaceholderData } = useQuery({
    ...invitationsQueryOptions(event.id, { page, pageSize: PAGE_SIZE, q: q || undefined, status }),
    placeholderData: keepPreviousData,
  });
  const columns = useMemo(() => invitationColumns(event.id, locked), [event.id, locked]);
  const counts = data?.counts;
  const all = counts ? counts.used + counts.unused : undefined;
  const filtered = !!status || !!q;

  const inviteButton = (
    <Button onClick={() => setInviteOpen(true)} disabled={locked}>
      <MailPlus data-icon="inline-start" />
      เชิญผู้เข้าร่วม
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      {event.status !== "invite" && event.status !== "suspended" && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>อีเวนต์นี้ยังไม่ได้เผยแพร่แบบ “{statusInfo.invite.label}”</AlertTitle>
          <AlertDescription>
            เพิ่มรายชื่อไว้ก่อนได้ ระบบจะส่งอีเมลเชิญ และผู้ได้รับเชิญจะเปิดอีเวนต์ได้ เมื่อเปลี่ยนการเผยแพร่เป็น “{statusInfo.invite.label}” ในแท็บรายละเอียด
          </AlertDescription>
          <AlertAction>
            <Link
              to="/dashboard/events/$eventId"
              params={{ eventId: event.id }}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <PencilLine data-icon="inline-start" />
              ไปที่รายละเอียด
            </Link>
          </AlertAction>
        </Alert>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <MailCheck className="size-5 text-primary" />
            ผู้ได้รับเชิญ
          </h2>
          <p className="text-sm text-muted-foreground">
            ผู้ได้รับเชิญจะได้รับอีเมลพร้อมลิงก์อีเวนต์ และเปิดอีเวนต์ได้เมื่อเข้าสู่ระบบหรือสมัครด้วยอีเมลนั้น คำเชิญจะเป็น “ใช้แล้ว” เมื่อลงทะเบียนรับตั๋ว
          </p>
        </div>
        {inviteButton}
      </div>

      {/* nothing invited yet: one clear next step instead of an empty table with filters */}
      {!isPending && all === 0 && !filtered ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailPlus />
            </EmptyMedia>
            <EmptyTitle>ยังไม่มีผู้ได้รับเชิญ</EmptyTitle>
            <EmptyDescription>เชิญด้วยอีเมล ทั้งคนที่มีบัญชีแล้วและยังไม่ได้สมัคร วางหลายอีเมลพร้อมกันได้</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{inviteButton}</EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              variant="outline"
              className="flex-wrap"
              aria-label="กรองตามสถานะคำเชิญ"
              value={[status ?? "all"]}
              onValueChange={(value: string[]) => {
                if (!value[0]) return;
                const next = value[0] === "all" ? undefined : (value[0] as InvitationStatus);
                void navigate({ search: (prev) => ({ ...prev, status: next, page: undefined }) });
              }}
            >
              <ToggleGroupItem value="all">
                <ListFilter />
                ทั้งหมด
                {all !== undefined && <span className="text-muted-foreground tabular-nums">{all}</span>}
              </ToggleGroupItem>
              {statusFilters.map(({ value, label, icon: Icon }) => (
                <ToggleGroupItem key={value} value={value}>
                  <Icon />
                  {label}
                  {counts && <span className="text-muted-foreground tabular-nums">{counts[value]}</span>}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <InputGroup className="w-full sm:w-72">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                enterKeyHint="search"
                placeholder="ค้นหาอีเมลหรือชื่อ"
                aria-label="ค้นหาผู้ได้รับเชิญ"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" aria-label="ล้างคำค้นหา" onClick={() => setSearch("")}>
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
          <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
            <DataTable
              columns={columns}
              data={data?.items ?? []}
              isLoading={isPending}
              empty={{
                icon: SearchX,
                title: "ไม่พบผู้ได้รับเชิญที่ตรงกับตัวกรอง",
                description: q ? `ไม่มีอีเมลหรือชื่อที่ตรงกับ “${q}”` : "ลองเลือกสถานะอื่น",
              }}
              pagination={{
                state: { pageIndex: page - 1, pageSize: PAGE_SIZE },
                onChange: ({ pageIndex }) =>
                  void navigate({ search: (prev) => ({ ...prev, page: pageIndex > 0 ? pageIndex + 1 : undefined }) }),
                rowCount: data?.total ?? 0,
              }}
            />
          </div>
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => {
                setSearch("");
                void navigate({ search: {} });
              }}
            >
              <X data-icon="inline-start" />
              ล้างตัวกรอง
            </Button>
          )}
        </>
      )}

      <InviteDialog eventId={event.id} inviteOnly={event.status === "invite"} open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
