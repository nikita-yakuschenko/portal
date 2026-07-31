CREATE TABLE IF NOT EXISTS "partner_project_prices" (
  "id" text PRIMARY KEY NOT NULL,
  "partner_id" text NOT NULL,
  "project_id" text NOT NULL,
  "pricing_mode" text DEFAULT 'on_request' NOT NULL,
  "markup_percent" integer,
  "public_price" integer,
  "price_on_request" boolean DEFAULT true NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "extras" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_project_prices" ADD CONSTRAINT "partner_project_prices_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_project_prices" ADD CONSTRAINT "partner_project_prices_project_id_catalog_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."catalog_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "partner_project_prices_partner_project_idx" ON "partner_project_prices" USING btree ("partner_id","project_id");
