CREATE TABLE "project_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"binding_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_components_project_slug_idx" ON "project_components" USING btree ("project_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "project_components_project_name_idx" ON "project_components" USING btree ("project_id","name");