CREATE TABLE "crm_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"phone_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_requests" ADD COLUMN "contact_id" text;--> statement-breakpoint
ALTER TABLE "site_requests" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_requests" ADD COLUMN "amount" integer;--> statement-breakpoint
ALTER TABLE "site_requests" ADD COLUMN "assignee_user_id" text;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_contacts_partner_phone_idx" ON "crm_contacts" USING btree ("partner_id","phone_key");--> statement-breakpoint
ALTER TABLE "site_requests" ADD CONSTRAINT "site_requests_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_requests" ADD CONSTRAINT "site_requests_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Разбираем накопленные заявки на контакт и сделку.
-- Контакт один на телефон в пределах партнёра: тот же покупатель мог
-- оставить несколько заявок.
INSERT INTO "crm_contacts" ("id", "partner_id", "name", "phone", "email", "phone_key", "created_at")
SELECT DISTINCT ON (r."partner_id", regexp_replace(r."customer_phone", '\D', '', 'g'))
	gen_random_uuid()::text,
	r."partner_id",
	r."customer_name",
	r."customer_phone",
	r."customer_email",
	regexp_replace(r."customer_phone", '\D', '', 'g'),
	r."created_at"
FROM "site_requests" r
WHERE regexp_replace(r."customer_phone", '\D', '', 'g') <> ''
ORDER BY r."partner_id", regexp_replace(r."customer_phone", '\D', '', 'g'), r."created_at";--> statement-breakpoint

UPDATE "site_requests" r
SET "contact_id" = c."id"
FROM "crm_contacts" c
WHERE c."partner_id" = r."partner_id"
	AND c."phone_key" = regexp_replace(r."customer_phone", '\D', '', 'g');--> statement-breakpoint

-- Название сделки: проект, если он был, иначе имя формы
UPDATE "site_requests" r
SET "title" = COALESCE(NULLIF(p."name", ''), r."form_name")
FROM "catalog_projects" p
WHERE p."id" = r."project_id";--> statement-breakpoint

UPDATE "site_requests" SET "title" = "form_name" WHERE "title" = '';
