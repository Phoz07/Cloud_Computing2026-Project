import { queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { registrationClient } from "./api";

type HoldResponse = NonNullable<
  Awaited<ReturnType<ReturnType<typeof registrationClient.api.regis["ticket-types"]>["hold"]["post"]>>["data"]
>;

/** A seat hold with `deadline`: when it lapses by this browser's clock, from the service's `expiresIn`. */
export type SeatHold = HoldResponse & { deadline: number };

const holdOf = (ticketTypeId: string) => registrationClient.api.regis["ticket-types"]({ ticketTypeId }).hold;
const withDeadline = (hold: HoldResponse): SeatHold => ({ ...hold, deadline: Date.now() + hold.expiresIn });

export const seatHoldKey = (ticketTypeId: string) => ["seat-hold", ticketTypeId] as const;

/**
 * The account's seat hold on a first_come ticket type, started when the enroll page opens. The
 * service answers a running hold unchanged, so a reload or another device picks it up with its
 * deadline. It POSTs, so it never refetches by itself (nor under enrollmentsKey): once a hold
 * lapses, holding again is the buyer's call (startSeatHold).
 */
export const seatHoldQueryOptions = (ticketTypeId: string) =>
  queryOptions({
    queryKey: seatHoldKey(ticketTypeId),
    queryFn: () => startSeatHold(ticketTypeId),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

/** Holds seats (or answers the running hold); `quantity` is what a new hold starts with. */
export async function startSeatHold(ticketTypeId: string, quantity?: number) {
  const { data, error } = await holdOf(ticketTypeId).post(quantity === undefined ? {} : { quantity });
  if (error) throw error;
  return withDeadline(data);
}

/** Changes how many seats the running hold has; it keeps its deadline. */
export async function resizeSeatHold(ticketTypeId: string, quantity: number) {
  const { data, error } = await holdOf(ticketTypeId).patch({ quantity });
  if (error) throw error;
  return withDeadline(data);
}

/** Milliseconds left until `deadline`, updated as each whole second of it passes (0 once it passed). */
export function useTimeLeft(deadline: number | undefined) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (deadline === undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const left = deadline - current;
      if (left > 0) timer = setTimeout(tick, left % 1000 || 1000);
    };
    tick();
    return () => clearTimeout(timer);
  }, [deadline]);
  return deadline === undefined ? undefined : Math.max(0, deadline - now);
}

/** 9:41 */
export const formatTimeLeft = (ms: number) => {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
