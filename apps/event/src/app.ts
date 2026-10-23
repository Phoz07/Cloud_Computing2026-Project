import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import { categories } from "./routes/categories";
import { eventRoutes } from "./routes/events";
import { invitations } from "./routes/invitations";
import { media } from "./routes/media";
import { ticketTypeRoutes } from "./routes/ticket-types";

export const event = new Elysia({ prefix: "/api/events" })
  .use(authGuard)
  .get("/health", () => "โอเค")
  .use(categories)
  .use(eventRoutes)
  .use(media)
  .use(invitations)
  .use(ticketTypeRoutes);

export type Event = typeof event;
