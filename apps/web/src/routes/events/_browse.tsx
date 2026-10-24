import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { CalendarDays, CalendarX, ChevronLeft, ChevronRight, History, Search, SearchX, Sparkles, Tag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { EventCard } from "@/components/event-card";
import { UserAvatar } from "@/components/user-avatar";
import { categoriesQueryOptions, publicEventsQueryOptions } from "@/lib/events";
import { organizerQueryOptions } from "@/lib/organizers";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

// Pathless layout for /events and /events/categories/$category: the page lives here, so switching
// category keeps it mounted (search box, focus, previous results) instead of swapping route components.
export const Route = createFileRoute("/events/_browse")({
  validateSearch: z.object({
    q: z.string().optional(),
    organizer: z.uuid().optional(),
    when: z.enum(["upcoming", "past"]).optional(),
    page: z.number().int().min(1).optional(),
  }),
  component: EventsListPage,
});

function EventsListPage() {
  // `to: "."` keeps the current path; navigating from this layout would resolve "." to /events and drop the category
  const navigate = useNavigate();
  const { category: slug } = useParams({ strict: false });
  const { q = "", organizer, when = "upcoming", page = 1 } = Route.useSearch();
  const [search, setSearch] = useState(q);
  const debouncedSearch = useDebouncedValue(search.trim());

  useEffect(() => {
    if (debouncedSearch !== q) {
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, q: debouncedSearch || undefined, page: undefined }),
        replace: true,
      });
    }
  }, [debouncedSearch, q, navigate]);

  const { data: categories, isError: categoriesError } = useQuery(categoriesQueryOptions);
  const category = slug ? categories?.find((c) => c.slug === slug) : undefined;
  const categoryMissing = !!slug && !!categories && !category;
  const { data, isError, isPlaceholderData } = useQuery({
    ...publicEventsQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      q: q || undefined,
      categoryId: category?.id,
      organizerId: organizer,
      when,
    }),
    // the API filters by id, so a category path waits for the slug to resolve
    enabled: !slug || !!category,
    placeholderData: keepPreviousData,
  });
  const pageCount = Math.max(Math.ceil((data?.total ?? 0) / PAGE_SIZE), 1);
  const filtered = !!q || !!slug || !!organizer;
  const goToPage = (next: number) => {
    void navigate({ to: ".", search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const selectCategory = (id: string) => {
    const next = categories?.find((c) => c.id === id);
    if (next) {
      void navigate({
        to: "/events/categories/$category",
        params: { category: next.slug },
        search: (prev) => ({ ...prev, page: undefined }),
      });
    } else {
      void navigate({ to: "/events", search: (prev) => ({ ...prev, page: undefined }) });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-4">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Sparkles className="size-7 text-primary" />
          สำรวจอีเวนต์
        </h1>
        <p className="text-muted-foreground">ค้นหาอีเวนต์ที่น่าสนใจ แล้วไปร่วมสนุกกัน</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <InputGroup className="max-w-md flex-1">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              enterKeyHint="search"
              placeholder="ค้นหาชื่ออีเวนต์หรือสถานที่"
              aria-label="ค้นหาอีเวนต์"
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
          <ToggleGroup
            variant="outline"
            aria-label="ช่วงเวลา"
            value={[when]}
            onValueChange={(value: string[]) =>
              value[0] &&
              void navigate({
                to: ".",
                search: (prev) => ({ ...prev, when: value[0] === "past" ? "past" : undefined, page: undefined }),
              })
            }
          >
            <ToggleGroupItem value="upcoming">
              <CalendarDays />
              กำลังจะมาถึง
            </ToggleGroupItem>
            <ToggleGroupItem value="past">
              <History />
              ผ่านไปแล้ว
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {organizer && (
          <OrganizerFilter
            organizerId={organizer}
            onClear={() =>
              void navigate({ to: ".", search: (prev) => ({ ...prev, organizer: undefined, page: undefined }) })
            }
          />
        )}
        {!!categories?.length && (
          <ToggleGroup
            variant="outline"
            size="sm"
            className="flex-wrap"
            aria-label="หมวดหมู่"
            value={category ? [category.id] : slug ? [] : ["all"]}
            onValueChange={(value: string[]) => value[0] && selectCategory(value[0])}
          >
            <ToggleGroupItem value="all">
              <Tag />
              ทุกหมวดหมู่
            </ToggleGroupItem>
            {categories.map((c) => (
              <ToggleGroupItem key={c.id} value={c.id}>
                {c.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>

      {isError || (slug && categoriesError) ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarX />
            </EmptyMedia>
            <EmptyTitle>โหลดอีเวนต์ไม่สำเร็จ</EmptyTitle>
            <EmptyDescription>กรุณาลองใหม่อีกครั้ง</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : categoryMissing ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>ไม่พบหมวดหมู่นี้</EmptyTitle>
            <EmptyDescription>หมวดหมู่อาจถูกลบหรือเปลี่ยนชื่อแล้ว</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              to="/events"
              search={(prev) => ({ ...prev, page: undefined })}
              className={buttonVariants({ variant: "outline" })}
            >
              <Tag data-icon="inline-start" />
              ดูทุกหมวดหมู่
            </Link>
          </EmptyContent>
        </Empty>
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarX />
            </EmptyMedia>
            <EmptyTitle>{when === "past" ? "ยังไม่มีอีเวนต์ที่ผ่านไปแล้ว" : "ยังไม่มีอีเวนต์ที่กำลังจะมาถึง"}</EmptyTitle>
            <EmptyDescription>{filtered ? "ลองเปลี่ยนคำค้นหาหรือหมวดหมู่" : "กลับมาดูใหม่เร็วๆ นี้"}</EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  void navigate({ to: "/events", search: (prev) => ({ when: prev.when }) });
                }}
              >
                <X data-icon="inline-start" />
                ล้างตัวกรอง
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div
          className={cn("grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3", isPlaceholderData && "opacity-60")}
        >
          {data.items.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="หน้า">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            <ChevronLeft data-icon="inline-start" />
            ก่อนหน้า
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            หน้า {page} จาก {pageCount}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => goToPage(page + 1)}>
            ถัดไป
            <ChevronRight data-icon="inline-end" />
          </Button>
        </nav>
      )}
    </div>
  );
}

/** "Events by …" chip shown while the list is narrowed to one organizer (from an event page's organizer section). */
function OrganizerFilter({ organizerId, onClear }: { organizerId: string; onClear: () => void }) {
  const { data: organizer } = useQuery(organizerQueryOptions(organizerId));
  return (
    <div className="flex items-center gap-2 self-start rounded-full border py-1 pr-1 pl-1.5 text-sm">
      {organizer ? <UserAvatar user={organizer} size="sm" /> : <Skeleton className="size-6 rounded-full" />}
      <span>
        อีเวนต์จาก <span className="font-medium">{organizer?.name ?? "ผู้จัดงาน"}</span>
      </span>
      <Button variant="ghost" size="icon-xs" aria-label="แสดงอีเวนต์จากทุกผู้จัดงาน" onClick={onClear}>
        <X />
      </Button>
    </div>
  );
}
