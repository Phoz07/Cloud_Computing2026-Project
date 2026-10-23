import { t, type UnwrapModels } from "elysia";

export const CheckoutPost = {
  Body: t.Object({ enrollmentId: t.String({ format: "uuid" }) }),
  // the Stripe Checkout page to send the buyer to
  Response: t.Object({ url: t.String() }),
};
export type CheckoutPost = UnwrapModels<typeof CheckoutPost>;
