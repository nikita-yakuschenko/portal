ALTER TABLE "catalog_projects" ADD COLUMN IF NOT EXISTS "sync_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;
