import { queryOptions } from "@tanstack/react-query";
import { authClient } from "./api";

export type ApplicationStatus = "pending" | "approved" | "rejected" | "cancelled";

export const myApplicationQueryOptions = queryOptions({
  queryKey: ["organizer-applications", "me"],
  queryFn: async () => {
    const { data, error } = await authClient.api.auth["organizer-applications"].me.get();
    if (error) throw error;
    return data.application;
  },
});

// prefixed by myApplicationQueryOptions' key, so invalidating that refreshes this too
export const myApplicationHistoryQueryOptions = queryOptions({
  queryKey: ["organizer-applications", "me", "history"],
  queryFn: async () => {
    const { data, error } = await authClient.api.auth["organizer-applications"].me.history.get();
    if (error) throw error;
    return data;
  },
});

export type MyApplication = NonNullable<
  Awaited<ReturnType<typeof authClient.api.auth["organizer-applications"]["me"]["get"]>>["data"]
>["application"] & {};

// Admin-only list; the sidebar badge and the overview reuse the pending slice.
export const applicationsQueryOptions = (status?: ApplicationStatus) =>
  queryOptions({
    queryKey: ["organizer-applications", "list", status ?? "all"],
    queryFn: async () => {
      const { data, error } = await authClient.api.auth["organizer-applications"].get({
        query: status ? { status } : {},
      });
      if (error) throw error;
      return data;
    },
  });

// Admin-only: every application of one applicant, for the history in the review dialog.
export const applicantHistoryQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["organizer-applications", "list", "user", userId],
    queryFn: async () => {
      const { data, error } = await authClient.api.auth["organizer-applications"].get({ query: { userId } });
      if (error) throw error;
      return data;
    },
  });

export const pendingApplicationsQueryOptions = applicationsQueryOptions("pending");

export type ApplicationRow = NonNullable<
  Awaited<ReturnType<typeof authClient.api.auth["organizer-applications"]["get"]>>["data"]
>[number];
