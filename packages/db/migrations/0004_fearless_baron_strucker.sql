CREATE TABLE "project_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"deployment_name" text NOT NULL,
	"subdomain" text NOT NULL,
	"frontend_domain" text NOT NULL,
	"backend_domain" text NOT NULL,
	"remote_path" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"deployed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_deployments" ADD CONSTRAINT "project_deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deployments" ADD CONSTRAINT "project_deployments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_deployments_subdomain_idx" ON "project_deployments" USING btree ("subdomain");--> statement-breakpoint
CREATE UNIQUE INDEX "project_deployments_project_subdomain_idx" ON "project_deployments" USING btree ("project_id","subdomain");