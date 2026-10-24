import { queryOptions } from "@tanstack/react-query";
import { authClient } from "./api";
import { retryUnlessClientError } from "./events";

/** Public profile of an event's organizer (name, avatar, since when); 404 for anyone who doesn't organize. */
export const organizerQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["organizers", id],
    queryFn: async () => {
      const { data, error } = await authClient.api.auth.organizers({ id }).get();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
    retry: retryUnlessClientError,
  });

export type OrganizerProfile = NonNullable<
  Awaited<ReturnType<ReturnType<typeof authClient.api.auth.organizers>["get"]>>["data"]
>;
