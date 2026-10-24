import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import * as CheckoutModel from "./model";
import { createCheckout } from "./service";

// The buyer's way to pay for an enrollment that waits for payment (apps/registration made it).
export const checkout = new Elysia()
  .use(authGuard)
  .post(
    "/checkout",
    { auth: true, body: CheckoutModel.CheckoutPost.Body, response: CheckoutModel.CheckoutPost.Response },
    ({ user, body }) => createCheckout(user, body.enrollmentId),
  );
