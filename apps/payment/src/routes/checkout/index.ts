import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import * as CheckoutModel from "./model";
import { createCheckout, verifyPayment } from "./service";

// The buyer's way to pay for an enrollment that waits for payment (apps/registration made it),
// and to check a payment the webhook hasn't confirmed.
export const checkout = new Elysia()
  .use(authGuard)
  .post(
    "/checkout",
    { auth: true, body: CheckoutModel.CheckoutPost.Body, response: CheckoutModel.CheckoutPost.Response },
    ({ user, body }) => createCheckout(user, body.enrollmentId),
  )
  // when the webhook hasn't confirmed a payment the buyer made
  .post(
    "/checkout/verify",
    { auth: true, body: CheckoutModel.CheckoutVerifyPost.Body, response: CheckoutModel.CheckoutVerifyPost.Response },
    ({ user, body }) => verifyPayment(user.id, body.enrollmentId),
  );
