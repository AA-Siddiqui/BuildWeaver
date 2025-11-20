import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './packages/db/migrations',
  schema: './packages/db/src/schema.ts',
  driver: 'pg',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'buildweaver'
  }
});
