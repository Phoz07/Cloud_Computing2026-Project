import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, ClipboardCheck, LayoutDashboard, Tags, UserRound, Users, type LucideIcon } from "lucide-react";
import type { Role } from "@app/auth-guard/permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { pendingApplicationsQueryOptions } from "@/lib/organizer-applications";
import { hasRole, useSession } from "@/lib/session";

type NavItem = {
  title: string;
  to: "/dashboard" | "/dashboard/events" | "/dashboard/categories" | "/dashboard/users" | "/dashboard/applications" | "/profile";
  icon: LucideIcon;
};

const sections: { label: string; roles: Role[]; items: NavItem[] }[] = [
  {
    label: "จัดการอีเวนต์",
    roles: ["organizer", "admin"],
    items: [
      { title: "ภาพรวม", to: "/dashboard", icon: LayoutDashboard },
      { title: "อีเวนต์ของฉัน", to: "/dashboard/events", icon: CalendarDays },
    ],
  },
  {
    label: "บัญชี",
    roles: ["organizer", "admin"],
    items: [{ title: "จัดการโปรไฟล์", to: "/profile", icon: UserRound }],
  },
  {
    label: "ผู้ดูแลระบบ",
    roles: ["admin"],
    items: [
      { title: "หมวดหมู่อีเวนต์", to: "/dashboard/categories", icon: Tags },
      { title: "ผู้ใช้", to: "/dashboard/users", icon: Users },
      { title: "คำขอเป็นผู้จัดงาน", to: "/dashboard/applications", icon: ClipboardCheck },
    ],
  },
];

// nested pages (e.g. editing an event) keep their section highlighted; the overview matches exactly
const isActive = (pathname: string, to: string) => {
  const path = pathname.replace(/\/$/, "");
  return path === to || (to !== "/dashboard" && path.startsWith(`${to}/`));
};

export function DashboardSidebar() {
  const { data: session } = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { setOpenMobile } = useSidebar();
  const isAdmin = hasRole(session?.user, ["admin"]);
  const { data: pending } = useQuery({ ...pendingApplicationsQueryOptions, enabled: isAdmin });

  return (
    // sits below the sticky 4.25rem (h-17) navbar instead of covering it
    <Sidebar className="top-17! h-[calc(100svh-4.25rem)]!">
      <SidebarContent>
        {sections
          .filter((section) => hasRole(session?.user, section.roles))
          .map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={isActive(pathname, item.to)}
                        render={<Link to={item.to} onClick={() => setOpenMobile(false)} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {item.to === "/dashboard/applications" && !!pending?.length && (
                        <SidebarMenuBadge>{pending.length}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>
    </Sidebar>
  );
}
