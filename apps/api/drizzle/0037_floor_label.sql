ALTER TABLE "catalog_assets" ADD COLUMN IF NOT EXISTS "floor_label" text;--> statement-breakpoint
ALTER TABLE "catalog_project_rooms" ADD COLUMN IF NOT EXISTS "floor_label" text;
