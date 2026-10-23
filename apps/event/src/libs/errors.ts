import { HTTPError } from "elysia";

export class EventNotFound extends HTTPError.id("EVENT_NOT_FOUND", 404) {
  override readonly detail = "ไม่พบอีเวนต์นี้";
}
