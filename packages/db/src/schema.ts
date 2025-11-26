import { relations, sql } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { PageBuilderState, PageDynamicInput, ProjectGraphSnapshot } from '@buildweaver/libs';

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

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects)
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id]
  }),
  pages: many(projectPages),
  graph: one(projectGraphs)
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectPage = typeof projectPages.$inferSelect;
export type NewProjectPage = typeof projectPages.$inferInsert;
export type ProjectGraph = typeof projectGraphs.$inferSelect;
export type NewProjectGraph = typeof projectGraphs.$inferInsert;
