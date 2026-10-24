import { t, type UnwrapModels } from "elysia";

export const CheckoutPost = {
  Body: t.Object({ enrollmentId: t.String({ format: "uuid" }) }),
  // the Stripe Checkout page to send the buyer to
  Response: t.Object({ url: t.String() }),
};
export type CheckoutPost = UnwrapModels<typeof CheckoutPost>;

// `awaiting_payment` past its hold reads as `expired`
const Status = t.Union([
  t.Literal("pending"),
  t.Literal("awaiting_payment"),
  t.Literal("confirmed"),
  t.Literal("rejected"),
  t.Literal("expired"),
  t.Literal("cancelled"),
]);

export const CheckoutVerifyPost = {
  Body: t.Object({ enrollmentId: t.String({ format: "uuid" }) }),
  // the enrollment's status once what Stripe knows is settled
  Response: t.Object({ status: Status }),
};
export type CheckoutVerifyPost = UnwrapModels<typeof CheckoutVerifyPost>;
