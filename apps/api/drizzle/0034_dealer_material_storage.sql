ALTER TABLE "dealer_materials" ALTER COLUMN "url" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "dealer_materials" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "dealer_materials" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "dealer_materials" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "dealer_materials" ADD COLUMN "byte_size" integer;
