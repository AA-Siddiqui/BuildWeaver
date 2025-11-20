import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const placeholder = pgTable('placeholder', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
