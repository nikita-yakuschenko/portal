ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "inn" text;
--> statement-breakpoint
-- Подтянуть ИНН из одобренных заявок по email
UPDATE "partners" AS p
SET "inn" = a."inn"
FROM "partner_applications" AS a
WHERE a."email" = p."email"
  AND a."status" = 'approved'
  AND a."inn" IS NOT NULL
  AND a."inn" <> ''
  AND (p."inn" IS NULL OR p."inn" = '');
