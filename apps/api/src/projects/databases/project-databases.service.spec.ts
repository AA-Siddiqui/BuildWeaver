import type { DatabaseSchema } from '@buildweaver/libs';
import { newDb } from 'pg-mem';
import type { Pool } from 'pg';
import type { DatabaseService } from '../../database/database.service';
import { ProjectDatabasesService } from './project-databases.service';

const connection = {
  host: 'localhost',
  port: 5432,
  database: 'app',
  user: 'tester',
  ssl: false
} as const;

describe('ProjectDatabasesService', () => {
  const ownershipStub = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue([{ id: 'project-1', ownerId: 'owner-1' }])
        }))
      }))
    }))
  } as unknown as DatabaseService['db'];

  const databaseStub = { db: ownershipStub } as unknown as DatabaseService;

  const buildService = () => new ProjectDatabasesService(databaseStub);

  const createInMemoryPool = (): Pool => {
    const db = newDb();
    const adapter = db.adapters.createPg();
    const { Pool: MemPool } = adapter;
    return new MemPool() as unknown as Pool;
  };

  it('applies schema and creates tables with relationships', async () => {
    const service = buildService();
    const pool = createInMemoryPool();

    const schema: DatabaseSchema = {
      id: 'db-1',
      name: 'Analytics',
      tables: [
        {
          id: 'users',
          name: 'users',
          fields: [
            { id: 'user-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'user-email', name: 'email', type: 'string', nullable: false, unique: true }
          ]
        },
        {
          id: 'orders',
          name: 'orders',
          fields: [
            { id: 'order-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'order-total', name: 'total', type: 'number', nullable: false, unique: false }
          ]
        }
      ],
      relationships: [
        {
          id: 'rel_orders_users',
          sourceTableId: 'orders',
          targetTableId: 'users',
          cardinality: 'many',
          modality: 1
        }
      ],
      connection
    };

    const result = await service.applySchema('owner-1', 'project-1', schema, { pool });

    expect(result.statements.length).toBeGreaterThan(0);

    const client = await pool.connect();
    const usersColumns = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users'"
    );
    const ordersColumns = await client.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='orders'"
    );
    client.release();

    expect(usersColumns.rows.find((row) => row.column_name === 'email')).toBeDefined();
    expect(ordersColumns.rows.find((row) => row.column_name === 'users_id')).toBeDefined();
    expect(ordersColumns.rows.find((row) => row.column_name === 'users_id')?.is_nullable).toBe('NO');
    expect(result.statements.some((statement) => statement.includes('FOREIGN KEY'))).toBe(true);
  });

  it('sanitizes unsafe identifiers before applying', async () => {
    const service = buildService();
    const pool = createInMemoryPool();
    const schema: DatabaseSchema = {
      id: 'db-2',
      name: 'Bad Schema',
      tables: [
        {
          id: 'table-1',
          name: 'Users Table 1',
          fields: [
            { id: 'id', name: 'User Identifier', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'email', name: 'Email Address', type: 'string', nullable: false, unique: true }
          ]
        }
      ],
      relationships: [],
      connection
    };

    const result = await service.applySchema('owner-1', 'project-1', schema, { pool });
    expect(result.statements.length).toBeGreaterThan(0);

    const client = await pool.connect();
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='Users_Table_1'"
    );
    client.release();

    expect(tables.rowCount).toBe(1);
  });

  it('omits empty string defaults to avoid invalid SQL', async () => {
    const service = buildService();
    const pool = createInMemoryPool();
    const schema: DatabaseSchema = {
      id: 'db-3',
      name: 'Defaults',
      tables: [
        {
          id: 'numbers',
          name: 'numbers',
          fields: [
            { id: 'id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            {
              id: 'value',
              name: 'value',
              type: 'number',
              nullable: false,
              unique: false,
              defaultValue: ''
            }
          ]
        }
      ],
      relationships: [],
      connection
    };

    const result = await service.applySchema('owner-1', 'project-1', schema, { pool });

    expect(result.statements.some((statement) => statement.includes('DEFAULT'))).toBe(false);

    const client = await pool.connect();
    const columns = await client.query(
      "SELECT column_default FROM information_schema.columns WHERE table_name='numbers' AND column_name='value'"
    );
    client.release();

    expect(columns.rows[0]?.column_default).toBeNull();
  });
});
