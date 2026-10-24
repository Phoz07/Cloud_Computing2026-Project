import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { hasRole } from "@/lib/session";

export const Route = createFileRoute("/_authed/dashboard")({
  beforeLoad: ({ context }) => {
    if (!hasRole(context.session.user, ["organizer", "admin"])) throw redirect({ to: "/" });
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    // -m-4 w-auto cancels the root <main> padding so the shell spans the page under the navbar
    <SidebarProvider className="-m-4 min-h-[calc(100svh-4.25rem)] w-auto">
      <DashboardSidebar />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4 data-vertical:self-auto" />
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <LayoutDashboard className="size-4" />
            แดชบอร์ด
          </span>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
