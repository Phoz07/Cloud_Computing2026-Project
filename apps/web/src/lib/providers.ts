import { queryOptions } from "@tanstack/react-query";
import { authClient } from "./api";

// Which social logins the auth service has configured; it only changes on a server restart.
export const providersQueryOptions = queryOptions({
  queryKey: ["auth-providers"],
  queryFn: async () => {
    const { data, error } = await authClient.api.auth.providers.get();
    if (error) throw error;
    return data;
  },
  staleTime: Infinity,
});
