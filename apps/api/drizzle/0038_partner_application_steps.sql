ALTER TYPE "partner_application_status" ADD VALUE IF NOT EXISTS 'contract';--> statement-breakpoint
ALTER TYPE "partner_application_status" ADD VALUE IF NOT EXISTS 'edo';--> statement-breakpoint
ALTER TABLE "partner_applications" ADD COLUMN IF NOT EXISTS "company_card" jsonb;
