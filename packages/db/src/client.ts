import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export interface CreateDatabaseOptions {
  connectionString: string;
  ssl?: PoolConfig['ssl'];
}

export const createDatabase = ({ connectionString, ssl }: CreateDatabaseOptions) => {
  if (!connectionString) {
    throw new Error('Database connection string is not defined');
  }

  const pool = new Pool({ connectionString, ssl });
  const db = drizzle(pool, { schema });

  return { db, pool };
};

export * as dbSchema from './schema';
