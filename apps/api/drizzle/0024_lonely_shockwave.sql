ALTER TABLE "partner_sites" ADD COLUMN "published_config" jsonb;--> statement-breakpoint
-- Живые сайты не должны пропасть: их текущий конфиг и есть опубликованная версия
UPDATE "partner_sites" SET "published_config" = "config" WHERE "status" = 'published' AND "published_config" IS NULL;
