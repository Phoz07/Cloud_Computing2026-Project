CREATE TABLE "seat_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"holder_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seat_holds_quantity_check" CHECK ("seat_holds"."quantity" >= 1)
);
--> statement-breakpoint
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_holder_id_users_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seat_holds_ticket_type_id_holder_id_idx" ON "seat_holds" USING btree ("ticket_type_id","holder_id");--> statement-breakpoint
CREATE INDEX "seat_holds_event_id_expires_at_idx" ON "seat_holds" USING btree ("event_id","expires_at");--> statement-breakpoint
CREATE INDEX "seat_holds_holder_id_idx" ON "seat_holds" USING btree ("holder_id");