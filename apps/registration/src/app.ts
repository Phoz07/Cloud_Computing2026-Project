import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import { availability } from "./routes/availability";
import { enrollmentRoutes } from "./routes/enrollments";
import { ticketRoutes } from "./routes/tickets";

export const registration = new Elysia({ prefix: "/api/regis" })
  .use(authGuard)
  .get("/health", () => "โอเค")
  .use(availability)
  .use(enrollmentRoutes)
  .use(ticketRoutes);

export type Registration = typeof registration;
