ALTER TABLE "catalog_projects" ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb NOT NULL;
