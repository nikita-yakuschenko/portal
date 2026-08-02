ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "catalog_project_order" jsonb DEFAULT '[]'::jsonb NOT NULL;
