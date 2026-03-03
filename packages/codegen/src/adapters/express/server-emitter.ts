import type { DatabaseSchema } from '@buildweaver/libs';
import type { GeneratedFile } from '../../core/bundle';

const LOG_PREFIX = '[Codegen:Express:Server]';

export const toEnvPrefix = (name: string): string =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '') || 'DB';

export const createConfigFile = (databases: DatabaseSchema[]): string => {
  const dbEntries = databases.map((db) => {
    const prefix = toEnvPrefix(db.name);
    return `    '${db.id}': {
      host: process.env.${prefix}_HOST ?? '${db.connection?.host ?? 'localhost'}',
      port: parseInt(process.env.${prefix}_PORT ?? '${db.connection?.port ?? 5432}', 10),
      database: process.env.${prefix}_NAME ?? '${db.connection?.database ?? 'postgres'}',
      user: process.env.${prefix}_USER ?? '${db.connection?.user ?? 'postgres'}',
      password: process.env.${prefix}_PASSWORD ?? '${db.connection?.password ?? ''}',
      ssl: process.env.${prefix}_SSL === 'true',
    }`;
  });

  const dbObject =
    databases.length > 0
      ? `{\n${dbEntries.join(',\n')}\n  }`
      : '{} as Record<string, DatabaseConfig>';

  return `import 'dotenv/config';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  databases: ${dbObject} as Record<string, DatabaseConfig>,
};

console.info('[Config] Loaded configuration', {
  port: config.port,
  databases: Object.keys(config.databases),
});
`;
};

export const createServerEntry = (hasDatabases: boolean): string => {
  const dbImport = hasDatabases
    ? "import { initDatabases, closeDatabases } from './db/connections';\n"
    : '';
  const dbInit = hasDatabases
    ? `    console.info('[Server] Initializing database connections...');
    await initDatabases();
    console.info('[Server] Database connections established');\n`
    : '';
  const dbShutdown = hasDatabases
    ? `\n  console.info('[Server] Closing database connections...');\n  await closeDatabases();`
    : '';

  return `import express from 'express';
import cors from 'cors';
import { config } from './config';
import { registerRoutes } from './routes';
import { errorHandler } from './middleware/error-handler';
${dbImport}
const app = express();

// ── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.info(\`[\${new Date().toISOString()}] \${req.method} \${req.path}\`);
  next();
});

// ── Routes ───────────────────────────────────────────────────────
registerRoutes(app);

// ── Error handler (must be registered last) ──────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────
const start = async () => {
  try {
${dbInit}    app.listen(config.port, () => {
      console.info(\`[Server] API server ready on http://localhost:\${config.port}\`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
};

start();

// ── Graceful shutdown ────────────────────────────────────────────
const shutdown = async () => {
  console.info('[Server] Shutting down gracefully...');${dbShutdown}
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
`;
};

export const createErrorHandler = (): string => `import type { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error(\`[Error] \${req.method} \${req.path}: \${err.message}\`);
  console.error('[Error] Stack:', err.stack);
  res.status(500).json({
    error: {
      message: err.message || 'Internal server error',
    },
  });
};
`;

export const createEnvFile = (databases: DatabaseSchema[]): string => {
  let content = '# Server\nPORT=3000\n';

  for (const db of databases) {
    const prefix = toEnvPrefix(db.name);
    content += `\n# Database: ${db.name}\n`;
    content += `${prefix}_HOST=${db.connection?.host ?? 'localhost'}\n`;
    content += `${prefix}_PORT=${db.connection?.port ?? 5432}\n`;
    content += `${prefix}_NAME=${db.connection?.database ?? 'postgres'}\n`;
    content += `${prefix}_USER=${db.connection?.user ?? 'postgres'}\n`;
    content += `${prefix}_PASSWORD=${db.connection?.password ?? ''}\n`;
    content += `${prefix}_SSL=${db.connection?.ssl ? 'true' : 'false'}\n`;
  }

  if (databases.length === 0) {
    content += '\n# No databases configured. Add databases in the Logic Editor.\n';
  }

  return content;
};

export const createEnvExampleFile = (databases: DatabaseSchema[]): string => {
  let content = '# Server\nPORT=3000\n';

  for (const db of databases) {
    const prefix = toEnvPrefix(db.name);
    content += `\n# Database: ${db.name}\n`;
    content += `${prefix}_HOST=localhost\n`;
    content += `${prefix}_PORT=5432\n`;
    content += `${prefix}_NAME=\n`;
    content += `${prefix}_USER=postgres\n`;
    content += `${prefix}_PASSWORD=\n`;
    content += `${prefix}_SSL=false\n`;
  }

  return content;
};

export const createServerFiles = (databases: DatabaseSchema[]): GeneratedFile[] => {
  const hasDatabases = databases.length > 0;
  console.info(`${LOG_PREFIX} Creating server files (databases: ${databases.length})`);

  return [
    { path: 'src/index.ts', contents: createServerEntry(hasDatabases) },
    { path: 'src/config.ts', contents: createConfigFile(databases) },
    { path: 'src/middleware/error-handler.ts', contents: createErrorHandler() },
    { path: '.env', contents: createEnvFile(databases) },
    { path: '.env.example', contents: createEnvExampleFile(databases) },
  ];
};
