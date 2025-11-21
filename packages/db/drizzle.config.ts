import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';

// Load the repository root .env so CLI tools like drizzle-kit pick up DB credentials
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString =
  process.env.DB_URL ?? process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/buildweaver';

export default defineConfig({
  out: './migrations',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString
  }
});
