import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// One atomic shop document per authenticated owner. Optimistic versioning keeps
// inventory reservations, movements and payment records consistent together.
export const shops = sqliteTable('shops', {
  owner: text('owner').primaryKey(),
  version: integer('version').notNull().default(0),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
});
