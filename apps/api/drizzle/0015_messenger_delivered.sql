ALTER TABLE "messenger_messages" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;
