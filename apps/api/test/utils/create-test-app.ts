import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DataType, newDb } from 'pg-mem';
import { Pool, FieldDef, QueryResult } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { AppModule } from '../../src/app.module';
import { DRIZZLE, PG_POOL } from '../../src/database/database.constants';
import { dbSchema, Database } from '@buildweaver/db';

export const createTestApp = async (): Promise<INestApplication> => {
  const memoryDb = newDb({ autoCreateForeignKeyIndices: false });
  memoryDb.registerExtension('pgcrypto', (schema) => {
    schema.registerFunction({
      name: 'gen_random_uuid',
      returns: DataType.uuid,
      implementation: randomUUID,
      impure: true
    });
  });
  memoryDb.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: randomUUID,
    impure: true
  });
  memoryDb.registerLanguage('plpgsql', ({ code, schema }) => () => {
    const statements = code
      .trim()
      .replace(/^BEGIN\s*/i, '')
      .replace(/\s*END\s*$/i, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
      .filter((statement) => !/^BEGIN$/i.test(statement) && !/^END$/i.test(statement));

    for (const statement of statements) {
      if (/^CREATE\s+EXTENSION/i.test(statement)) {
        // Extension already registered in pg-mem for tests.
        continue;
      }
      schema.none(statement);
    }
    return null;
  });
  const adapter = memoryDb.adapters.createPg();
  const pool = new adapter.Pool() as unknown as Pool & {
    query: Pool['query'];
  };
  const originalQuery = pool.query.bind(pool);
  const ensureFields = (result: QueryResult | undefined) => {
    if (!result) {
      return result;
    }
    const fields = result.fields as FieldDef[] | undefined;
    if (!fields?.length && Array.isArray(result.rows) && result.rows.length > 0) {
      const firstRow = result.rows[0] as Record<string, unknown>;
      const derivedFields: FieldDef[] = Object.keys(firstRow).map((name, index) => ({
        name,
        tableID: 0,
        columnID: index,
        dataTypeID: 0,
        dataTypeSize: 0,
        dataTypeModifier: 0,
        format: 'text'
      }));
      Object.defineProperty(result, 'fields', {
        value: derivedFields,
        configurable: true
      });
    }
    return result;
  };

  const normalizeResult = (result: QueryResult | undefined, expectArrayRows: boolean): QueryResult | undefined => {
    if (!result) {
      return result;
    }
    ensureFields(result);
    if (expectArrayRows && Array.isArray(result.rows)) {
      const fields = (result.fields ?? []) as FieldDef[];
      const fieldNames = fields.map((field) => field.name);
      const rowsAsArrays = result.rows.map((row) => {
        const record = row as Record<string, unknown>;
        return fieldNames.map((name) => record[name]);
      });
      Object.defineProperty(result, 'rows', {
        value: rowsAsArrays,
        configurable: true
      });
    }
    return result;
  };

  pool.query = ((text: unknown, values?: unknown, callback?: unknown) => {
    let expectsArrayMode = false;
    if (typeof text === 'object' && text !== null) {
      const queryObject = text as { types?: unknown; rowMode?: unknown };
      if ('types' in queryObject) {
        delete queryObject.types;
      }
      if (queryObject.rowMode === 'array') {
        expectsArrayMode = true;
        delete queryObject.rowMode;
      }
    }

    if (typeof callback === 'function') {
      return originalQuery(text as any, values as any, (err: unknown, result: QueryResult | undefined) => {
        if (!err) {
          normalizeResult(result, expectsArrayMode);
        }
        (callback as (err: unknown, result: QueryResult | undefined) => unknown)(err, result);
      });
    }

    const result = originalQuery(text as any, values as any) as unknown;
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      return (result as Promise<unknown>).then((res) => normalizeResult(res as QueryResult | undefined, expectsArrayMode));
    }
    return normalizeResult(result as QueryResult | undefined, expectsArrayMode);
  }) as Pool['query'];
  const drizzleDb: Database = drizzle(pool, { schema: dbSchema });

  await migrate(drizzleDb, {
    migrationsFolder: join(__dirname, '../../../../packages/db/migrations')
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(pool)
    .overrideProvider(DRIZZLE)
    .useValue(drizzleDb)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
};
