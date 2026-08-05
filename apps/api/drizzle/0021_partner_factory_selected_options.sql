ALTER TABLE "partner_project_prices" ADD COLUMN IF NOT EXISTS "factory_selected_options" jsonb DEFAULT '[]'::jsonb NOT NULL;
