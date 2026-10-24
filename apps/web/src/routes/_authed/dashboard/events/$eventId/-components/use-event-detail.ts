import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { eventQueryOptions } from "@/lib/events";

/** The event a tab under /dashboard/events/$eventId works on. The layout mounts tabs only once it has loaded, so this never suspends. */
export function useEventDetail() {
  const { eventId } = useParams({ from: "/_authed/dashboard/events/$eventId" });
  return useSuspenseQuery(eventQueryOptions(eventId)).data;
}
