import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import { checkout } from "./routes/checkout";
import { refundRoutes } from "./routes/refunds";
import { webhook } from "./routes/webhook";

export const payment = new Elysia({ prefix: "/api/payment" })
  .use(authGuard)
  .get("/health", () => "โอเค")
  .use(checkout)
  .use(refundRoutes)
  .use(webhook);

export type Payment = typeof payment;
