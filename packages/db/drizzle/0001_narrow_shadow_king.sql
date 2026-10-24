CREATE TYPE "public"."organizer_application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "organizer_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_name" text NOT NULL,
	"contact" text NOT NULL,
	"reason" text NOT NULL,
	"status" "organizer_application_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizer_applications" ADD CONSTRAINT "organizer_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_applications" ADD CONSTRAINT "organizer_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizer_applications_user_id_idx" ON "organizer_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organizer_applications_status_idx" ON "organizer_applications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "organizer_applications_one_pending_idx" ON "organizer_applications" USING btree ("user_id") WHERE "organizer_applications"."status" = 'pending';