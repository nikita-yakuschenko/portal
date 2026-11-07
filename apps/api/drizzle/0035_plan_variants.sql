ALTER TABLE "catalog_assets" ADD COLUMN IF NOT EXISTS "variant_label" text;--> statement-breakpoint
ALTER TABLE "catalog_assets" ADD COLUMN IF NOT EXISTS "variant_index" integer;--> statement-breakpoint
ALTER TABLE "catalog_project_rooms" ADD COLUMN IF NOT EXISTS "variant_label" text;--> statement-breakpoint
ALTER TABLE "catalog_project_rooms" ADD COLUMN IF NOT EXISTS "variant_index" integer;
