import { pgTable, text, timestamp, integer, numeric, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_columns";

export const events = pgTable("events", {
  id: id(),
  title: text("title").notNull(),
  description: text("description"),
  coverImageKey: text("cover_image_key"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

export const ticketTypes = pgTable("ticket_types", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  quota: integer("quota").notNull(),
  ...timestamps,
});