import { treaty } from "@elysia/eden";
import type { Event as EventApp } from "@app/event";

export const eventClient = treaty<EventApp>(window.location.origin);

