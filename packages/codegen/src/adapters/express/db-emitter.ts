import type { DatabaseSchema } from '@buildweaver/libs';
import type { GeneratedFile } from '../../core/bundle';

const LOG_PREFIX = '[Codegen:Express:DB]';

export const createConnectionsFile = (databases: DatabaseSchema[]): string => {
  if (databases.length === 0) {
    console.info(`${LOG_PREFIX} No databases configured – emitting stub connections`);
    return `// No databases configured. Add databases in the Logic Editor to generate connection code.

console.info('[DB] No database connections configured');

export const initDatabases = async (): Promise<void> => {
  console.info('[DB] No databases to initialize');
};

export const getPool = (name: string): never => {
  throw new Error(\`Database "\${name}" not configured. Add databases in the Logic Editor.\`);
};

export const closeDatabases = async (): Promise<void> => {
  console.info('[DB] No databases to close');
};
`;
  }

  console.info(`${LOG_PREFIX} Emitting connections for ${databases.length} database(s)`);

  return `import { Pool } from 'pg';
import { config } from '../config';

const pools: Record<string, Pool> = {};

export const initDatabases = async (): Promise<void> => {
  for (const [name, dbConfig] of Object.entries(config.databases)) {
    console.info(
      \`[DB] Connecting to "\${name}" at \${dbConfig.host}:\${dbConfig.port}/\${dbConfig.database}...\`,
    );

    pools[name] = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
    });

    try {
      const client = await pools[name].connect();
      console.info(\`[DB] Database "\${name}" connected successfully\`);
      client.release();
    } catch (err) {
      console.error(\`[DB] Failed to connect to database "\${name}":\`, err);
      throw err;
    }
  }
};

export const getPool = (name: string): Pool => {
  const pool = pools[name];
  if (!pool) {
    const available = Object.keys(pools).join(', ') || '(none)';
    console.error(\`[DB] Requested pool "\${name}" not found. Available: \${available}\`);
    throw new Error(\`Database "\${name}" is not initialized. Available: \${available}\`);
  }
  return pool;
};

export const closeDatabases = async (): Promise<void> => {
  for (const [name, pool] of Object.entries(pools)) {
    console.info(\`[DB] Closing connection to "\${name}"...\`);
    await pool.end();
    console.info(\`[DB] Database "\${name}" closed\`);
  }
};
`;
};

export const createDbFiles = (databases: DatabaseSchema[]): GeneratedFile[] => {
  console.info(`${LOG_PREFIX} Creating database files (${databases.length} database(s))`);
  return [
    { path: 'src/db/connections.ts', contents: createConnectionsFile(databases) },
  ];
};
