CREATE TYPE "public"."messenger_conversation_type" AS ENUM('dm', 'request', 'channel');--> statement-breakpoint
CREATE TYPE "public"."messenger_request_status" AS ENUM('open', 'in_progress', 'closed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messenger_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "messenger_conversation_type" NOT NULL,
	"partner_id" text,
	"title" text DEFAULT '' NOT NULL,
	"request_number" text,
	"project_id" text,
	"status" "messenger_request_status",
	"created_by_user_id" text,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messenger_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messenger_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"storage_key" text NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messenger_reads" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "messenger_conversations" ADD CONSTRAINT "messenger_conversations_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_conversations" ADD CONSTRAINT "messenger_conversations_project_id_catalog_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."catalog_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_conversations" ADD CONSTRAINT "messenger_conversations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD CONSTRAINT "messenger_messages_conversation_id_messenger_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."messenger_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD CONSTRAINT "messenger_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_attachments" ADD CONSTRAINT "messenger_attachments_message_id_messenger_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messenger_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_reads" ADD CONSTRAINT "messenger_reads_conversation_id_messenger_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."messenger_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_reads" ADD CONSTRAINT "messenger_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messenger_conversations_partner_type_idx" ON "messenger_conversations" USING btree ("partner_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messenger_conversations_request_number_idx" ON "messenger_conversations" USING btree ("request_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messenger_conversations_last_message_idx" ON "messenger_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messenger_conversations_dm_partner_uidx" ON "messenger_conversations" ("partner_id") WHERE "type" = 'dm';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messenger_messages_conversation_created_idx" ON "messenger_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messenger_reads_conversation_user_idx" ON "messenger_reads" USING btree ("conversation_id","user_id");
