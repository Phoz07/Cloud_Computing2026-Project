import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, CalendarPlus, CalendarX, History, Megaphone, RotateCw, Search, Tag, Telescope, UserPlus } from "lucide-react";
import { useState } from "react";
import { EventCard } from "@/components/event-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { categoriesQueryOptions, publicEventsQueryOptions } from "@/lib/events";
import { hasRole, useSession } from "@/lib/session";

const UPCOMING = 6;

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 py-4">
      <Hero />
      <Categories />
      <UpcomingEvents />
      <HostCta />
    </div>
  );
}

function Hero() {
  const navigate = Route.useNavigate();
  const [search, setSearch] = useState("");

  return (
    <section className="flex flex-col gap-8 rounded-3xl border bg-muted/40 px-6 py-10 sm:px-12 sm:py-16">
      <div className="flex max-w-2xl flex-col gap-4">
        {/* Thai has no word spaces: break at the phrase boundary rather than leave "ทันที" alone on a line */}
        <h1 className="text-4xl leading-snug font-bold tracking-tight sm:text-5xl">
          ค้นหาอีเวนต์ที่อยากไป <span className="sm:block">แล้วจองตั๋วได้ทันที</span>
        </h1>
        <p className="text-lg text-muted-foreground">ลงทะเบียนเสร็จแล้ว ตั๋วจะส่งไปที่อีเมลของคุณ และเปิดดูได้ทุกเมื่อในหน้าตั๋วของฉัน</p>
      </div>
      <form
        role="search"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ to: "/events", search: { q: search.trim() || undefined } });
        }}
      >
        <InputGroup className="h-11 sm:max-w-md">
          <InputGroupInput
            enterKeyHint="search"
            placeholder="ค้นหาชื่ออีเวนต์หรือสถานที่"
            aria-label="ค้นหาอีเวนต์"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" variant="default" size="sm">
              <Search data-icon="inline-start" />
              ค้นหา
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Link to="/events" className={buttonVariants({ variant: "outline", size: "lg" })}>
          <Telescope data-icon="inline-start" />
          สำรวจอีเวนต์
        </Link>
      </form>
    </section>
  );
}

function Categories() {
  const { data: categories, isPending } = useQuery(categoriesQueryOptions);
  if (!isPending && !categories?.length) return null;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="categories-heading">
      <h2 id="categories-heading" className="flex items-center gap-2 text-xl font-bold">
        <Tag className="size-5 text-primary" />
        หมวดหมู่
      </h2>
      <div className="flex flex-wrap gap-2">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 w-24 rounded-4xl" />)
          : categories?.map((c) => (
              <Link
                key={c.id}
                to="/events/categories/$category"
                params={{ category: c.slug }}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {c.name}
              </Link>
            ))}
      </div>
    </section>
  );
}

function UpcomingEvents() {
  const { data, isError, refetch, isRefetching } = useQuery(publicEventsQueryOptions({ page: 1, pageSize: UPCOMING }));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="upcoming-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="upcoming-heading" className="flex items-center gap-2 text-xl font-bold">
          <CalendarDays className="size-5 text-primary" />
          อีเวนต์ที่กำลังจะมาถึง
        </h2>
        {!!data?.total && (
          <Link to="/events" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            ดูทั้งหมด
            <ArrowRight data-icon="inline-end" />
          </Link>
        )}
      </div>

      {isError ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarX />
            </EmptyMedia>
            <EmptyTitle>โหลดอีเวนต์ไม่สำเร็จ</EmptyTitle>
            <EmptyDescription>กรุณาลองใหม่อีกครั้ง</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" disabled={isRefetching} onClick={() => void refetch()}>
              <RotateCw data-icon="inline-start" />
              ลองอีกครั้ง
            </Button>
          </EmptyContent>
        </Empty>
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: UPCOMING }, (_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarX />
            </EmptyMedia>
            <EmptyTitle>ยังไม่มีอีเวนต์ที่กำลังจะมาถึง</EmptyTitle>
            <EmptyDescription>กลับมาดูใหม่เร็วๆ นี้ หรือดูอีเวนต์ที่จัดไปแล้ว</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/events" search={{ when: "past" }} className={buttonVariants({ variant: "outline" })}>
              <History data-icon="inline-start" />
              ดูอีเวนต์ที่ผ่านไปแล้ว
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </section>
  );
}

const approvalNote = "เมื่อผู้ดูแลระบบอนุมัติ คุณจะสร้างอีเวนต์ เปิดขายตั๋ว และเช็คอินผู้เข้าร่วมได้";

/** Where hosting starts depends on who's looking: sign up, apply, or go straight to a new event. */
function HostCta() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  return (
    <section aria-labelledby="host-heading">
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 id="host-heading" className="flex items-center gap-2 text-xl font-bold">
              <Megaphone className="size-5 text-primary" />
              จัดอีเวนต์ของคุณเอง
            </h2>
            {isPending ? (
              <Skeleton className="h-5 w-72 max-w-full" />
            ) : (
              <p className="text-muted-foreground">
                {!user
                  ? `สมัครสมาชิกแล้วยื่นใบสมัครเป็นผู้จัดงาน ${approvalNote}`
                  : hasRole(user, ["organizer", "admin"])
                    ? "สร้างอีเวนต์ใหม่ ตั้งประเภทตั๋ว แล้วเผยแพร่เมื่อพร้อม"
                    : `ยื่นใบสมัครเป็นผู้จัดงาน ${approvalNote}`}
              </p>
            )}
          </div>
          {isPending ? (
            <Skeleton className="h-10 w-40 shrink-0 rounded-4xl" />
          ) : !user ? (
            <Link
              to="/register"
              search={{ redirect: "/profile/organizer" }}
              className={buttonVariants({ size: "lg", className: "shrink-0" })}
            >
              <UserPlus data-icon="inline-start" />
              สมัครสมาชิก
            </Link>
          ) : hasRole(user, ["organizer", "admin"]) ? (
            <Link to="/dashboard/events/new" className={buttonVariants({ size: "lg", className: "shrink-0" })}>
              <CalendarPlus data-icon="inline-start" />
              สร้างอีเวนต์
            </Link>
          ) : (
            <Link to="/profile/organizer" className={buttonVariants({ size: "lg", className: "shrink-0" })}>
              <CalendarPlus data-icon="inline-start" />
              สมัครเป็นผู้จัดงาน
            </Link>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
