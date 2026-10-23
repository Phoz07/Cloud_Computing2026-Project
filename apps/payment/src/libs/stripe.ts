import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";

if (secretKey.startsWith("sk_live_") && process.env.NODE_ENV !== "production") {
  throw new Error("Refusing to use a live Stripe key outside production; use an sk_test_ key");
}

// The placeholder lets the service boot without a key; Stripe calls fail until one is set.
export const stripe = new Stripe(secretKey || "sk_test_placeholder");
