import { Elysia, HTTPError } from "elysia";
import { stripe, webhookSecret } from "../../libs/stripe";
import { handleStripeEvent } from "./service";

export class InvalidSignature extends HTTPError.id("INVALID_SIGNATURE", 400) {
  override readonly detail = "Invalid Stripe signature";
}

// Stripe posts Checkout events here; no session, the signature proves the sender.
// parse: 'none' keeps the raw body, which the signature is computed over. Under Bun the Stripe
// SDK verifies with SubtleCrypto, which only has the async variant.
export const webhook = new Elysia().post("/webhook", { parse: "none" }, async ({ request }) => {
  const payload = await request.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, request.headers.get("stripe-signature") ?? "", webhookSecret);
  } catch {
    return new InvalidSignature();
  }
  await handleStripeEvent(event);
  return { received: true };
});
