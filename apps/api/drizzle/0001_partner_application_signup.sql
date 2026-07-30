ALTER TABLE "partner_applications" ADD COLUMN "inn" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD COLUMN "interests" text;--> statement-breakpoint
ALTER TABLE "partner_applications" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_applications" ALTER COLUMN "password_hash" DROP NOT NULL;