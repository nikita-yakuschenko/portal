CREATE TYPE "public"."site_request_status" AS ENUM('new', 'in_progress', 'won', 'lost');--> statement-breakpoint
ALTER TABLE "site_requests" ADD COLUMN "status" "site_request_status" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_requests" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_requests" ADD COLUMN "note" text;