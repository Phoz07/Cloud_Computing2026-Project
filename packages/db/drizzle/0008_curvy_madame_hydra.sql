CREATE TYPE "public"."question_type" AS ENUM('short_text', 'long_text', 'choice');--> statement-breakpoint
CREATE TYPE "public"."ticket_type_kind" AS ENUM('first_come', 'approval', 'invite');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('pending', 'awaiting_payment', 'confirmed', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'expired', 'refunded');--> statement-breakpoint
CREATE TABLE "ticket_type_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"type" "question_type" NOT NULL,
	"label" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"options" text[],
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_type_questions_options_check" CHECK (("ticket_type_questions"."type" = 'choice') = ("ticket_type_questions"."options" is not null))
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"buyer_id" uuid,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"status" "enrollment_status" NOT NULL,
	"invitation_id" uuid,
	"expires_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_quantity_check" CHECK ("enrollments"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"stripe_session_id" text NOT NULL,
	"checkout_url" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"stripe_payment_intent_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"code" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "ticket_types" ALTER COLUMN "quota" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD COLUMN "kind" "ticket_type_kind" DEFAULT 'first_come' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD COLUMN "max_per_user" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_type_questions" ADD CONSTRAINT "ticket_type_questions_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_invitation_id_event_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."event_invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_type_questions_ticket_type_id_position_idx" ON "ticket_type_questions" USING btree ("ticket_type_id","position");--> statement-breakpoint
CREATE INDEX "enrollments_ticket_type_id_status_idx" ON "enrollments" USING btree ("ticket_type_id","status");--> statement-breakpoint
CREATE INDEX "enrollments_event_id_status_idx" ON "enrollments" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "enrollments_buyer_id_idx" ON "enrollments" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "enrollments_invitation_id_idx" ON "enrollments" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "payments_enrollment_id_idx" ON "payments" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "tickets_enrollment_id_idx" ON "tickets" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "tickets_email_idx" ON "tickets" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ticket_types_event_id_idx" ON "ticket_types" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_quota_check" CHECK (("ticket_types"."kind" = 'first_come') = ("ticket_types"."quota" is not null) and ("ticket_types"."quota" is null or "ticket_types"."quota" >= 1));--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_price_check" CHECK ("ticket_types"."price" >= 0);--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_max_per_user_check" CHECK ("ticket_types"."max_per_user" between 1 and 10);