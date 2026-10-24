import { queryOptions } from "@tanstack/react-query";
import { auth } from "@/lib/auth-client";

export const accountsQueryOptions = queryOptions({
  queryKey: ["accounts"],
  queryFn: async () => {
    const { data, error } = await auth.listAccounts();
    if (error) throw error;
    return data;
  },
});

export const sessionsQueryOptions = queryOptions({
  queryKey: ["sessions"],
  queryFn: async () => {
    const { data, error } = await auth.listSessions();
    if (error) throw error;
    return data;
  },
});
