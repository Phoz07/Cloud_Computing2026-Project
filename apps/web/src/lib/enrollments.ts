import { queryOptions } from "@tanstack/react-query";
import { CircleCheckBig, CircleX, Clock, CreditCard, Hourglass, Undo2, type LucideIcon } from "lucide-react";
import { registrationClient } from "./api";
import { retryUnlessClientError } from "./events";

export type EnrollmentStatus = "pending" | "awaiting_payment" | "confirmed" | "rejected" | "expired" | "cancelled";

type BadgeVariant = "secondary" | "default" | "outline" | "destructive";

export const enrollmentStatusInfo: Record<EnrollmentStatus, { label: string; icon: LucideIcon; variant: BadgeVariant }> = {
  pending: { label: "รออนุมัติ", icon: Hourglass, variant: "outline" },
  awaiting_payment: { label: "รอชำระเงิน", icon: CreditCard, variant: "secondary" },
  confirmed: { label: "ยืนยันแล้ว", icon: CircleCheckBig, variant: "default" },
  rejected: { label: "ไม่อนุมัติ", icon: CircleX, variant: "destructive" },
  expired: { label: "หมดเวลา", icon: Clock, variant: "outline" },
  cancelled: { label: "ยกเลิกแล้ว", icon: Undo2, variant: "outline" },
};

export const enrollmentsKey = ["enrollments"] as const;

export const availabilityQueryOptions = (eventId: string) =>
  queryOptions({
    queryKey: [...enrollmentsKey, "availability", eventId],
    queryFn: async () => {
      const { data, error } = await registrationClient.api.regis.events({ eventId }).availability.get();
      if (error) throw error;
      return data;
    },
    retry: retryUnlessClientError,
  });

export type Availability = NonNullable<
  Awaited<ReturnType<ReturnType<typeof registrationClient.api.regis.events>["availability"]["get"]>>["data"]
>[number];

export const enrollmentDetailKey = (enrollmentId: string) => [...enrollmentsKey, "detail", enrollmentId] as const;

export const enrollmentQueryOptions = (enrollmentId: string) =>
  queryOptions({
    queryKey: enrollmentDetailKey(enrollmentId),
    queryFn: async () => {
      const { data, error } = await registrationClient.api.regis.enrollments({ id: enrollmentId }).get();
      if (error) throw error;
      return data;
    },
    retry: retryUnlessClientError,
  });

export type Enrollment = NonNullable<
  Awaited<ReturnType<ReturnType<typeof registrationClient.api.regis.enrollments>["get"]>>["data"]
>;

export const eventEnrollmentsKey = (eventId: string) => [...enrollmentsKey, "event", eventId] as const;

export const eventEnrollmentsQueryOptions = (
  eventId: string,
  query: { page?: number; pageSize?: number; q?: string; status?: EnrollmentStatus; ticketTypeId?: string },
) =>
  queryOptions({
    queryKey: [...eventEnrollmentsKey(eventId), query],
    queryFn: async () => {
      const { data, error } = await registrationClient.api.regis.events({ eventId }).enrollments.get({ query });
      if (error) throw error;
      return data;
    },
  });

export const myTicketsQueryOptions = queryOptions({
  queryKey: [...enrollmentsKey, "mine"],
  queryFn: async () => {
    const { data, error } = await registrationClient.api.regis.tickets.mine.get();
    if (error) throw error;
    return data;
  },
});

export type MyTicket = NonNullable<
  Awaited<ReturnType<typeof registrationClient.api.regis.tickets.mine.get>>["data"]
>["tickets"][number];

export const ticketQueryOptions = (ticketId: string) =>
  queryOptions({
    queryKey: [...enrollmentsKey, "ticket", ticketId],
    queryFn: async () => {
      const { data, error } = await registrationClient.api.regis.tickets({ id: ticketId }).get();
      if (error) throw error;
      return data;
    },
    retry: retryUnlessClientError,
  });

/** "Somchai Jaidee" → first name "Somchai", last name "Jaidee"; the account's own fields win when set. */
export function splitName(user: { name: string; firstName?: string | null; lastName?: string | null }) {
  const [first = "", ...rest] = user.name.trim().split(/\s+/);
  return { firstName: user.firstName?.trim() || first, lastName: user.lastName?.trim() || rest.join(" ") };
}
