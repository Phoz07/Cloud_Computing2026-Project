import type { enrollments, events } from "@app/db";

type EnrollmentRow = typeof enrollments.$inferSelect;

const HOUR = 3_600_000;

/** `percent` of a THB amount, rounded to the satang, as Stripe takes it. */
export const refundSatang = (thb: number, percent: number) => Math.round((Math.round(thb * 100) * percent) / 100);

/**
 * What the buyer gets back by cancelling, under the refund policy the order was made with:
 * `percent` of what they paid, until `deadline` (the cutoff before the event's current start, so a
 * postponed event moves it). Null when the order has no policy, or one that refunds nothing.
 */
export function refundTerms(
  enrollment: Pick<EnrollmentRow, "refundPercent" | "refundCutoffHours" | "unitPrice" | "quantity">,
  event: Pick<typeof events.$inferSelect, "startsAt">,
) {
  const { refundPercent: percent, refundCutoffHours: cutoffHours } = enrollment;
  if (!percent || cutoffHours === null) return null;
  return {
    percent,
    deadline: new Date(event.startsAt.getTime() - cutoffHours * HOUR),
    // THB
    amount: refundSatang(Number(enrollment.unitPrice) * enrollment.quantity, percent) / 100,
  };
}
