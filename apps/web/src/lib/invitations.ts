import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { eventClient } from "./api";

export type InvitationStatus = "used" | "unused";

export const invitationsKey = (eventId: string) => ["invitations", eventId] as const;

export const invitationsQueryOptions = (
  eventId: string,
  query: { page?: number; pageSize?: number; q?: string; status?: InvitationStatus },
) =>
  queryOptions({
    queryKey: [...invitationsKey(eventId), query],
    queryFn: async () => {
      const { data, error } = await eventClient.api.events({ id: eventId }).invitations.get({ query });
      if (error) throw error;
      return data;
    },
  });

export type Invitation = NonNullable<
  Awaited<ReturnType<ReturnType<typeof eventClient.api.events>["invitations"]["get"]>>["data"]
>["items"][number];

/** The service takes at most this many emails per request. */
export const MAX_EMAILS_PER_INVITE = 100;

/** Emails typed or pasted into one box: split on commas, semicolons, spaces and new lines; lowercase; no repeats. */
export const parseEmails = (value: string) => [
  ...new Set(
    value
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ),
];

export const isEmail = (value: string) => z.email().safeParse(value).success;
