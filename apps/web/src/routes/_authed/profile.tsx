import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  CalendarPlus,
  LayoutDashboard,
  ChevronsUpDown,
  LockKeyhole,
  MonitorSmartphone,
  Ticket,
  Trash2,
  UserRound,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authed/profile")({
  component: ProfileLayout,
});

type NavItem = {
  title: string;
  icon: LucideIcon;
  /** omitted while the page isn't built yet; the item renders disabled */
  to?: "/profile" | "/profile/sign-in" | "/profile/sessions" | "/profile/organizer" | "/profile/delete" | "/dashboard" | "/tickets";
  exact?: boolean;
  /** hidden for this role */
  hiddenForRole?: string[];
  /** shown only to these roles */
  onlyForRoles?: string[];
  destructive?: boolean;
  /** items in different groups are divided by a separator */
  group: number;
};

const navItems: NavItem[] = [
  { title: "ข้อมูลบัญชี", to: "/profile", icon: UserRound, exact: true, group: 0 },
  { title: "ตั๋วของฉัน", to: "/tickets", icon: Ticket, group: 0 },
  { title: "ช่องทางเข้าสู่ระบบ", to: "/profile/sign-in", icon: LockKeyhole, group: 1 },
  { title: "อุปกรณ์ที่เข้าสู่ระบบ", to: "/profile/sessions", icon: MonitorSmartphone, group: 1 },
  { title: "แดชบอร์ดจัดการอีเวนต์", to: "/dashboard", icon: LayoutDashboard, onlyForRoles: ["organizer", "admin"], group: 2 },
  { title: "สมัครเป็นผู้จัดงาน", to: "/profile/organizer", icon: CalendarPlus, hiddenForRole: ["organizer", "admin"], group: 2 },
  { title: "ลบบัญชี", to: "/profile/delete", icon: Trash2, destructive: true, group: 3 },
];

const itemClass = (item: NavItem) =>
  cn(buttonVariants({ variant: "ghost" }), "justify-start", item.destructive && "text-destructive hover:text-destructive");

function SoonBadge() {
  return (
    <Badge variant="outline" className="ml-auto">
      เร็วๆ นี้
    </Badge>
  );
}

function ProfileLayout() {
  const guarded = Route.useRouteContext().session;
  const { data: session } = useSession();
  const role = (session?.user ?? guarded.user).role;
  const pathname = useRouterState({ select: (state) => state.location.pathname.replace(/\/$/, "") });
  const items = navItems.filter(
    (item) => !item.hiddenForRole?.includes(role ?? "") && (!item.onlyForRoles || item.onlyForRoles.includes(role ?? "")),
  );
  const current = items.find((item) => item.to === pathname) ?? items[0];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-4">
      <PageHeader icon={UserRoundCog} title="โปรไฟล์ของฉัน" description="จัดการบัญชี ความปลอดภัย และการเข้าสู่ระบบ" />
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        {/* mobile: one full-width dropdown instead of a sideways-scrolling strip */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="lg" className="w-full justify-between md:hidden" />}
            aria-label="เมนูโปรไฟล์"
          >
            <span className="flex items-center gap-2">
              <current.icon data-icon="inline-start" />
              {current.title}
            </span>
            <ChevronsUpDown data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--anchor-width) min-w-56">
            {items.map((item, index) => (
              <Fragment key={item.title}>
                {index > 0 && items[index - 1].group !== item.group && <DropdownMenuSeparator />}
                {item.to ? (
                  <DropdownMenuItem variant={item.destructive ? "destructive" : "default"} render={<Link to={item.to} />}>
                    <item.icon />
                    {item.title}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>
                    <item.icon />
                    {item.title}
                    <SoonBadge />
                  </DropdownMenuItem>
                )}
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <nav aria-label="เมนูโปรไฟล์" className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1">
          {items.map((item, index) => (
            <Fragment key={item.title}>
              {index > 0 && items[index - 1].group !== item.group && <Separator className="my-1" />}
              {item.to ? (
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  className={itemClass(item)}
                  activeProps={{ className: "bg-muted" }}
                >
                  <item.icon data-icon="inline-start" />
                  {item.title}
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(itemClass(item), "pointer-events-none opacity-60")}>
                  <item.icon data-icon="inline-start" />
                  {item.title}
                  <SoonBadge />
                </span>
              )}
            </Fragment>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
