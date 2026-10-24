import Navbar from "@/components/navbar";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Navbar />
      <main className="p-4">
        <Outlet />
      </main>
    </>
  ),
});
