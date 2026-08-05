ALTER TABLE "catalog_projects" ADD COLUMN IF NOT EXISTS "factory_offer" jsonb DEFAULT '{}'::jsonb NOT NULL;
