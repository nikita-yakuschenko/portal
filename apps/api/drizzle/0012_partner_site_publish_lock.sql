ALTER TABLE "partner_sites" ADD COLUMN IF NOT EXISTS "publish_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_sites" ADD COLUMN IF NOT EXISTS "publish_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partner_sites" ADD COLUMN IF NOT EXISTS "publish_locked_by_user_id" text;--> statement-breakpoint
ALTER TABLE "partner_sites" ADD COLUMN IF NOT EXISTS "publish_lock_notice" text;--> statement-breakpoint
ALTER TABLE "partner_sites" ADD COLUMN IF NOT EXISTS "publish_lock_notice_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partner_sites" ADD COLUMN IF NOT EXISTS "republish_request_status" text;--> statement-breakpoint
ALTER TABLE "partner_sites" ADD COLUMN IF NOT EXISTS "republish_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partner_sites" ADD COLUMN IF NOT EXISTS "republish_request_comment" text;
