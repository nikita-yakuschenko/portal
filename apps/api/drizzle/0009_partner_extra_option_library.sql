ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "extra_option_library" jsonb DEFAULT '[]'::jsonb NOT NULL;
