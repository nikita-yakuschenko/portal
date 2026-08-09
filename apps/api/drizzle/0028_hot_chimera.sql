CREATE TYPE "public"."site_request_event_type" AS ENUM('created', 'status_changed', 'note', 'crm_delivery');--> statement-breakpoint
CREATE TABLE "site_request_events" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"type" "site_request_event_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"author_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_request_events" ADD CONSTRAINT "site_request_events_request_id_site_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."site_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_request_events" ADD CONSTRAINT "site_request_events_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_request_events_request_idx" ON "site_request_events" USING btree ("request_id","created_at");--> statement-breakpoint

-- Уже накопленным заявкам заводим событие создания, иначе лента у них пустая
INSERT INTO "site_request_events" ("id", "request_id", "type", "payload", "created_at")
SELECT gen_random_uuid()::text, r."id", 'created', jsonb_build_object('formName', r."form_name"), r."created_at"
FROM "site_requests" r;
