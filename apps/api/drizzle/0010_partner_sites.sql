CREATE TYPE "public"."partner_site_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_sites" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"subdomain" text NOT NULL,
	"domain" text,
	"status" "partner_site_status" DEFAULT 'draft' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "partner_sites" ADD CONSTRAINT "partner_sites_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "partner_sites_partner_id_idx" ON "partner_sites" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "partner_sites_subdomain_idx" ON "partner_sites" USING btree ("subdomain");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "partner_sites_domain_idx" ON "partner_sites" USING btree ("domain");
