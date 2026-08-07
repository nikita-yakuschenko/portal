CREATE TABLE "social_profile_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"username" text NOT NULL,
	"profile_url" text NOT NULL,
	"source" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_attempt_status" text,
	"last_error_class" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "social_profile_snapshots_platform_username_idx" ON "social_profile_snapshots" USING btree ("platform","username");