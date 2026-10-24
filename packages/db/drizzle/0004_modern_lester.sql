CREATE TYPE "public"."event_status" AS ENUM('draft', 'public', 'private', 'suspended');--> statement-breakpoint
CREATE TABLE "event_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "event_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "venue" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "venue_description" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "venue_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "status" "event_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_refund_available" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "refund_cutoff_hours" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "refund_percent" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "publish_at" timestamp with time zone;--> statement-breakpoint
INSERT INTO "event_categories" ("name", "slug") VALUES ('ทั่วไป', 'general');--> statement-breakpoint
UPDATE "events" SET
	"category_id" = (SELECT "id" FROM "event_categories" WHERE "slug" = 'general'),
	"slug" = 'event-' || left("id"::text, 8),
	"venue" = '-';--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "venue" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_category_id_event_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_category_id_idx" ON "events" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_refund_check" CHECK ("events"."is_refund_available" = false or ("events"."refund_cutoff_hours" is not null and "events"."refund_percent" between 0 and 100));