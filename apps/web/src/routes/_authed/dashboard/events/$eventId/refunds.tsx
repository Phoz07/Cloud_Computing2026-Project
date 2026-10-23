import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleX, Hourglass, ListFilter, Receipt, ReceiptText, SearchX, Users, Wallet, X, type LucideIcon } from "lucide-react";
import { z } from "zod";
import { DataTable } from "@/components/data-table/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatBaht, formatDuration } from "@/lib/format";
import { eventRefundsQueryOptions, refundStatusInfo, type RefundStatus } from "@/lib/refunds";
import { cn } from "@/lib/utils";
import { refundColumns } from "./-components/refunds-columns";
import { useEventDetail } from "./-components/use-event-detail";

const PAGE_SIZE = 10;
const STATUSES = ["pending", "requires_action", "succeeded", "failed", "canceled"] as const;

// filters live in the URL, like the participants tab
export const Route = createFileRoute("/_authed/dashboard/events/$eventId/refunds")({
  validateSearch: z.object({
    status: z.enum(STATUSES).optional(),
    page: z.number().int().min(1).optional(),
  }),
  component: RefundsTab,
});

function RefundsTab() {
  const event = useEventDetail();
  const navigate = Route.useNavigate();
  const { status, page = 1 } = Route.useSearch();
  const { data, isPending, isPlaceholderData } = useQuery({
    ...eventRefundsQueryOptions(event.id, { page, pageSize: PAGE_SIZE, status }),
    placeholderData: keepPreviousData,
  });
  const counts = data?.counts;
  const all = counts ? STATUSES.reduce((sum, key) => sum + counts[key], 0) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <ReceiptText className="size-5 text-primary" />
          คืนเงิน
        </h2>
        <p className="text-sm text-muted-foreground">
          ประวัติการคืนเงินของอีเวนต์นี้ ผู้ซื้อยกเลิกและรับเงินคืนเองได้ตามนโยบาย ส่วนการคืนเงินเต็มจำนวนทำได้จากแท็บผู้เข้าร่วม
        </p>
      </div>

      <Alert>
        <Receipt />
        <AlertTitle>
          {event.isRefundAvailable && event.refundCutoffHours !== null && event.refundPercent !== null
            ? `คืนเงิน ${event.refundPercent}% เมื่อขอคืนก่อนงานเริ่มอย่างน้อย ${formatDuration(event.refundCutoffHours * 3_600_000)}`
            : "อีเวนต์นี้ไม่รับคืนเงิน"}
        </AlertTitle>
        <AlertDescription>
          การลงทะเบียนแต่ละรายการใช้นโยบาย ณ ตอนที่ลงทะเบียน การแก้นโยบายมีผลกับการลงทะเบียนใหม่เท่านั้น
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Wallet} label="ยอดคืนเงินรวม" value={data && formatBaht(data.refundedTotal)} />
        <StatCard icon={Hourglass} label="กำลังดำเนินการ" value={counts && (counts.pending + counts.requires_action).toLocaleString("th-TH")} />
        <StatCard icon={CircleX} label="คืนเงินไม่สำเร็จ" value={counts?.failed.toLocaleString("th-TH")} />
      </div>

      {!isPending && all === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptText />
            </EmptyMedia>
            <EmptyTitle>ยังไม่มีการคืนเงิน</EmptyTitle>
            <EmptyDescription>เมื่อผู้ซื้อขอคืนเงิน หรือคุณคืนเงินให้ผู้ลงทะเบียน รายการจะแสดงที่นี่</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              to="/dashboard/events/$eventId/participants"
              params={{ eventId: event.id }}
              className={buttonVariants({ variant: "outline" })}
            >
              <Users data-icon="inline-start" />
              ดูผู้เข้าร่วม
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <ToggleGroup
            variant="outline"
            className="flex-wrap"
            aria-label="กรองตามสถานะ"
            value={[status ?? "all"]}
            onValueChange={(value: string[]) => {
              if (!value[0]) return;
              const next = value[0] === "all" ? undefined : (value[0] as RefundStatus);
              void navigate({ search: { status: next } });
            }}
          >
            <ToggleGroupItem value="all">
              <ListFilter />
              ทั้งหมด
              {all !== undefined && <span className="text-muted-foreground tabular-nums">{all}</span>}
            </ToggleGroupItem>
            {STATUSES.map((value) => {
              const { label, icon: Icon } = refundStatusInfo[value];
              return (
                <ToggleGroupItem key={value} value={value}>
                  <Icon />
                  {label}
                  {counts && <span className="text-muted-foreground tabular-nums">{counts[value]}</span>}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
            <DataTable
              columns={refundColumns}
              data={data?.items ?? []}
              isLoading={isPending}
              empty={{
                icon: SearchX,
                title: "ไม่พบการคืนเงินในสถานะนี้",
                description: "ลองเลือกสถานะอื่น",
                action: status && (
                  <Button variant="outline" onClick={() => void navigate({ search: {} })}>
                    <X data-icon="inline-start" />
                    ล้างตัวกรอง
                  </Button>
                ),
              }}
              pagination={{
                state: { pageIndex: page - 1, pageSize: PAGE_SIZE },
                onChange: ({ pageIndex }) =>
                  void navigate({ search: (prev) => ({ ...prev, page: pageIndex > 0 ? pageIndex + 1 : undefined }) }),
                rowCount: data?.total ?? 0,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | undefined }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums">
          {value === undefined ? <Skeleton className="h-9 w-16" /> : value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
