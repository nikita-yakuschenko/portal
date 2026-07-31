ALTER TABLE "catalog_projects" ADD COLUMN "technology" text DEFAULT 'modular' NOT NULL;--> statement-breakpoint
UPDATE "catalog_projects" SET "technology" = 'panel_frame' WHERE "name" !~* '^модульный\s+дом';--> statement-breakpoint
UPDATE "catalog_projects" SET "name" = regexp_replace("name", '^\s*модульный\s+дом\s+', '', 'i') WHERE "name" ~* '^\s*модульный\s+дом\s+';
