CREATE TYPE "public"."crm_delivery_status" AS ENUM('skipped', 'pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "site_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"project_id" text,
	"form_name" text DEFAULT 'Форма на сайте' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"message" text,
	"utm" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"page_url" text,
	"crm_status" "crm_delivery_status" DEFAULT 'skipped' NOT NULL,
	"crm_error" text,
	"crm_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_requests" ADD CONSTRAINT "site_requests_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_requests" ADD CONSTRAINT "site_requests_project_id_catalog_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."catalog_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Переносим накопленные заявки: тип события становится именем формы,
-- статус доставки берём из последней попытки, если она была
INSERT INTO "site_requests" (
	"id", "partner_id", "project_id", "form_name",
	"customer_name", "customer_phone", "customer_email", "message",
	"crm_status", "crm_error", "crm_sent_at", "created_at"
)
SELECT
	e."id",
	e."partner_id",
	e."project_id",
	CASE e."type"::text
		WHEN 'price_request' THEN 'Расчёт стоимости'
		WHEN 'contact_request' THEN 'Консультация'
		ELSE 'Форма на сайте'
	END,
	e."customer_name",
	e."customer_phone",
	e."customer_email",
	e."message",
	COALESCE(
		(SELECT CASE d."status"::text
			WHEN 'sent' THEN 'sent'::"crm_delivery_status"
			WHEN 'failed' THEN 'failed'::"crm_delivery_status"
			ELSE 'pending'::"crm_delivery_status"
		END
		FROM "lead_deliveries" d
		WHERE d."lead_event_id" = e."id"
		ORDER BY d."attempted_at" DESC NULLS LAST
		LIMIT 1),
		'skipped'::"crm_delivery_status"
	),
	(SELECT d."error_message" FROM "lead_deliveries" d
		WHERE d."lead_event_id" = e."id"
		ORDER BY d."attempted_at" DESC NULLS LAST LIMIT 1),
	(SELECT d."attempted_at" FROM "lead_deliveries" d
		WHERE d."lead_event_id" = e."id" AND d."status"::text = 'sent'
		ORDER BY d."attempted_at" DESC NULLS LAST LIMIT 1),
	e."created_at"
FROM "lead_events" e
WHERE e."type"::text IN ('price_request', 'contact_request');
