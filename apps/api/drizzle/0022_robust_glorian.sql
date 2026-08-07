CREATE TABLE "catalog_project_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"floor_number" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"area" real NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"polygon" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_project_rooms" ADD CONSTRAINT "catalog_project_rooms_project_id_catalog_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."catalog_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_project_rooms_project_floor_idx" ON "catalog_project_rooms" USING btree ("project_id","floor_number");
