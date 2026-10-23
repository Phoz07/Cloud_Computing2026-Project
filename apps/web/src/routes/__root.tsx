import Navbar from "@/components/navbar";
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <Navbar />
      <main className="p-4">
        <Outlet />
      </main>
    </>
  ),
});