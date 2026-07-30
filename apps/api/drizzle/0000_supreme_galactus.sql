CREATE TYPE "public"."catalog_source" AS ENUM('tilda');--> statement-breakpoint
CREATE TYPE "public"."crm_provider" AS ENUM('amocrm', 'bitrix24');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('new', 'answered');--> statement-breakpoint
CREATE TYPE "public"."lead_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('project_view', 'price_request', 'contact_request', 'crm_delivery_succeeded', 'crm_delivery_failed');--> statement-breakpoint
CREATE TYPE "public"."partner_application_status" AS ENUM('new', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."partner_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('company_admin', 'company_manager', 'partner_owner', 'partner_member');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"source_url" text NOT NULL,
	"local_path" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "catalog_source" DEFAULT 'tilda' NOT NULL,
	"source_uid" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"area" integer,
	"floors" integer,
	"bedrooms" integer,
	"bathrooms" text,
	"base_price" integer,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"project_url" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "sync_status" NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"assets_discovered" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"provider" "crm_provider" NOT NULL,
	"portal_url" text NOT NULL,
	"credentials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_event_id" text NOT NULL,
	"crm_connection_id" text NOT NULL,
	"status" "lead_delivery_status" NOT NULL,
	"external_lead_id" text,
	"error_message" text,
	"attempted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"project_id" text,
	"type" "lead_type" NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"region" text NOT NULL,
	"message" text,
	"password_hash" text NOT NULL,
	"status" "partner_application_status" DEFAULT 'new' NOT NULL,
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "partner_inquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" "inquiry_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" text PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"legal_name" text,
	"status" "partner_status" DEFAULT 'active' NOT NULL,
	"region" text NOT NULL,
	"manager_name" text,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_id" text,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_assets" ADD CONSTRAINT "catalog_assets_project_id_catalog_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."catalog_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_connections" ADD CONSTRAINT "crm_connections_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_deliveries" ADD CONSTRAINT "lead_deliveries_lead_event_id_lead_events_id_fk" FOREIGN KEY ("lead_event_id") REFERENCES "public"."lead_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_deliveries" ADD CONSTRAINT "lead_deliveries_crm_connection_id_crm_connections_id_fk" FOREIGN KEY ("crm_connection_id") REFERENCES "public"."crm_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_project_id_catalog_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."catalog_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_inquiries" ADD CONSTRAINT "partner_inquiries_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_projects_source_uid_idx" ON "catalog_projects" USING btree ("source","source_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_applications_email_idx" ON "partner_applications" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");