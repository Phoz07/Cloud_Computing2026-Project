import { relations, sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_columns";
import { users } from "./auth";

// Owned by apps/auth: a user asks to become an organizer, an admin approves (set-role) or rejects.
export const organizerApplicationStatus = pgEnum("organizer_application_status", [
  "pending",
  "approved",
  "rejected",
  // withdrawn by the applicant while pending; kept so their history stays complete
  "cancelled",
]);

export const organizerApplications = pgTable(
  "organizer_applications",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    organizationName: text("organization_name").notNull(),
    contact: text("contact").notNull(),
    reason: text("reason").notNull(),
    status: organizerApplicationStatus("status").default("pending").notNull(),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (table) => [
    index("organizer_applications_user_id_idx").on(table.userId),
    index("organizer_applications_status_idx").on(table.status),
    // at most one pending application per user
    uniqueIndex("organizer_applications_one_pending_idx")
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const organizerApplicationsRelations = relations(organizerApplications, ({ one }) => ({
  user: one(users, { fields: [organizerApplications.userId], references: [users.id] }),
  reviewer: one(users, { fields: [organizerApplications.reviewedBy], references: [users.id] }),
}));
