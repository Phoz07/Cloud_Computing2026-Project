import { Elysia } from "elysia";
import { authGuard } from "@app/auth-guard";
import { media } from "./routes/media";

export const event = new Elysia({ prefix: "/api/events" })
  .use(authGuard)
  .get("/health", () => "โอเค")
  .use(media);

export type Event = typeof event;
