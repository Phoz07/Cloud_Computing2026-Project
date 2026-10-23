import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, integer, numeric, uuid, index } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_columns";
import { users } from "./auth";

export const events = pgTable(
  "events",
  {
    id: id(),
    // restrict: deleting an organizer must not silently take their events (and tickets) with them
    organizerId: uuid("organizer_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    coverImageKey: text("cover_image_key"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("events_organizer_id_idx").on(table.organizerId)],
);

export const ticketTypes = pgTable("ticket_types", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  quota: integer("quota").notNull(),
  ...timestamps,
});

// Gallery images of an event; the objects live in S3 under public/events/<eventId>/assets/.
export const eventAssets = pgTable(
  "event_assets",
  {
    id: id(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    ...timestamps,
  },
  (table) => [index("event_assets_event_id_idx").on(table.eventId)],
);

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id] }),
  ticketTypes: many(ticketTypes),
  assets: many(eventAssets),
}));

export const ticketTypesRelations = relations(ticketTypes, ({ one }) => ({
  event: one(events, { fields: [ticketTypes.eventId], references: [events.id] }),
}));

export const eventAssetsRelations = relations(eventAssets, ({ one }) => ({
  event: one(events, { fields: [eventAssets.eventId], references: [events.id] }),
}));
