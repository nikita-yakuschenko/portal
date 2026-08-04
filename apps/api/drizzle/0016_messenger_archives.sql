CREATE TABLE IF NOT EXISTS "messenger_archives" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"archived_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "messenger_archives" ADD CONSTRAINT "messenger_archives_conversation_id_messenger_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."messenger_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_archives" ADD CONSTRAINT "messenger_archives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messenger_archives_conversation_user_idx" ON "messenger_archives" USING btree ("conversation_id","user_id");
