ALTER TABLE "catalog_assets" ADD COLUMN IF NOT EXISTS "is_hidden" boolean DEFAULT false NOT NULL;
