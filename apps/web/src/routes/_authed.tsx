import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionQueryOptions } from "@/lib/session";

// Pathless layout: every route under _authed/ requires a signed-in user.
export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!session) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { session };
  },
});
