import { relations, sql } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import {
  BuilderComponentDefinition,
  ComponentBindingReference,
  PageBuilderState,
  PageDynamicInput,
  ProjectGraphSnapshot
} from '@buildweaver/libs';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date())
});

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date())
});

export const projectPages = pgTable('project_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  builderState: jsonb('builder_state').$type<PageBuilderState>().notNull().default(sql`'{}'::jsonb`),
  dynamicInputs: jsonb('dynamic_inputs')
    .$type<PageDynamicInput[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date())
});

export const projectGraphs = pgTable(
  'project_graphs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    graph: jsonb('graph')
      .$type<ProjectGraphSnapshot>()
      .notNull()
      .default(sql`'{"nodes":[],"edges":[],"functions":[]}'::jsonb`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date())
  },
  (table) => ({
    projectUnique: uniqueIndex('project_graphs_project_id_idx').on(table.projectId)
  })
);

export const projectComponents = pgTable(
  'project_components',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    definition: jsonb('definition').$type<BuilderComponentDefinition>().notNull().default(sql`'{}'::jsonb`),
    bindingReferences: jsonb('binding_references')
      .$type<ComponentBindingReference[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date())
  },
  (table) => ({
    projectSlugUnique: uniqueIndex('project_components_project_slug_idx').on(table.projectId, table.slug),
    projectNameUnique: uniqueIndex('project_components_project_name_idx').on(table.projectId, table.name)
  })
);

export const projectDeployments = pgTable(
  'project_deployments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deploymentName: text('deployment_name').notNull(),
    subdomain: text('subdomain').notNull(),
    frontendDomain: text('frontend_domain').notNull(),
    backendDomain: text('backend_domain').notNull(),
    remotePath: text('remote_path').notNull(),
    status: text('status').notNull().default('pending'),
    lastError: text('last_error'),
    deployedAt: timestamp('deployed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date())
  },
  (table) => ({
    subdomainUnique: uniqueIndex('project_deployments_subdomain_idx').on(table.subdomain),
    projectSubdomainUnique: uniqueIndex('project_deployments_project_subdomain_idx').on(table.projectId, table.subdomain)
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  deployments: many(projectDeployments)
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id]
  }),
  pages: many(projectPages),
  graph: one(projectGraphs),
  components: many(projectComponents),
  deployments: many(projectDeployments)
}));

export const projectPagesRelations = relations(projectPages, ({ one }) => ({
  project: one(projects, {
    fields: [projectPages.projectId],
    references: [projects.id]
  })
}));

export const projectGraphsRelations = relations(projectGraphs, ({ one }) => ({
  project: one(projects, {
    fields: [projectGraphs.projectId],
    references: [projects.id]
  })
}));

export const projectComponentsRelations = relations(projectComponents, ({ one }) => ({
  project: one(projects, {
    fields: [projectComponents.projectId],
    references: [projects.id]
  })
}));

export const projectDeploymentsRelations = relations(projectDeployments, ({ one }) => ({
  project: one(projects, {
    fields: [projectDeployments.projectId],
    references: [projects.id]
  }),
  owner: one(users, {
    fields: [projectDeployments.ownerId],
    references: [users.id]
  })
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectPage = typeof projectPages.$inferSelect;
export type NewProjectPage = typeof projectPages.$inferInsert;
export type ProjectGraph = typeof projectGraphs.$inferSelect;
export type NewProjectGraph = typeof projectGraphs.$inferInsert;
export type ProjectComponent = typeof projectComponents.$inferSelect;
export type NewProjectComponent = typeof projectComponents.$inferInsert;
export type ProjectDeployment = typeof projectDeployments.$inferSelect;
export type NewProjectDeployment = typeof projectDeployments.$inferInsert;
