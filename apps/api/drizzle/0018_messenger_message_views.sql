CREATE TABLE IF NOT EXISTS "messenger_message_views" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "messenger_message_views" ADD CONSTRAINT "messenger_message_views_message_id_messenger_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messenger_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_message_views" ADD CONSTRAINT "messenger_message_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messenger_message_views_message_user_idx" ON "messenger_message_views" USING btree ("message_id","user_id");
