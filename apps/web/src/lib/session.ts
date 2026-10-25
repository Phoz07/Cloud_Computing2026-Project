import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { redirect, useNavigate, useRouter } from "@tanstack/react-router";
import type { Role } from "@app/auth-guard/permissions";
import { auth, type SessionUser } from "./auth-client";

export const sessionQueryOptions = queryOptions({
  queryKey: ["session"],
  queryFn: async () => {
    const { data, error } = await auth.getSession();
    if (error) throw error;
    return data; // null when signed out
  },
  staleTime: 30_000,
});

export const useSession = () => useQuery(sessionQueryOptions);

export const hasRole = (user: Pick<SessionUser, "role"> | null | undefined, roles: Role[]) =>
  !!user?.role && (roles as string[]).includes(user.role);

/** Refetches the session right away, e.g. after signing in, so route guards see the new user. */
export const refreshSession = (queryClient: QueryClient) =>
  queryClient.fetchQuery({ ...sessionQueryOptions, staleTime: 0 });

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      const { error } = await auth.signOut();
      if (error) throw error;
    },
    onSuccess: async () => {
      // Drop everything cached for the previous user, but keep the session query itself:
      // clear() detaches mounted observers (the navbar), so they would never see the null.
      queryClient.setQueryData(sessionQueryOptions.queryKey, null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== sessionQueryOptions.queryKey[0] });
      await navigate({ to: "/" });
      await router.invalidate();
    },
  });
}

/** Only same-site paths are allowed as post-login targets (blocks open redirects like //evil.com). */
export const safeRedirect = (target: string | undefined) =>
  target?.startsWith("/") && !target.startsWith("//") ? target : "/";

/** beforeLoad guard for guest-only pages (login, register, password reset). */
export async function redirectIfSignedIn(queryClient: QueryClient, target?: string) {
  const session = await queryClient.ensureQueryData(sessionQueryOptions).catch(() => null);
  if (session) throw redirect({ href: safeRedirect(target) });
}
