CREATE TYPE "public"."refund_initiator" AS ENUM('buyer', 'organizer', 'system');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'requires_action', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
ALTER TYPE "public"."enrollment_status" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"percent" integer NOT NULL,
	"status" "refund_status" NOT NULL,
	"initiated_by" "refund_initiator" NOT NULL,
	"requested_by" uuid,
	"note" text,
	"stripe_refund_id" text NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_stripe_refund_id_unique" UNIQUE("stripe_refund_id"),
	CONSTRAINT "refunds_percent_check" CHECK ("refunds"."percent" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "refund_percent" integer;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "refund_cutoff_hours" integer;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refunds_enrollment_id_idx" ON "refunds" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_payment_id_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_refund_check" CHECK (("enrollments"."refund_percent" is null) = ("enrollments"."refund_cutoff_hours" is null) and ("enrollments"."refund_percent" is null or "enrollments"."refund_percent" between 0 and 100));--> statement-breakpoint
-- backfill: orders made before the snapshot existed get their event's current refund policy
UPDATE "enrollments" SET "refund_percent" = "events"."refund_percent", "refund_cutoff_hours" = "events"."refund_cutoff_hours" FROM "events" WHERE "events"."id" = "enrollments"."event_id" AND "events"."is_refund_available" = true;
