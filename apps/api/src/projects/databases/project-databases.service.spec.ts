import { BadRequestException } from '@nestjs/common';
import type { DatabaseConnectionSettings, DatabaseSchema } from '@buildweaver/libs';
import { newDb } from 'pg-mem';
import type { Pool, PoolClient } from 'pg';
import type { DatabaseService } from '../../database/database.service';
import { ProjectDatabasesService } from './project-databases.service';
import { DatabaseSchemaException } from './exceptions/database-schema.exception';

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

    const result = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });

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

    const result = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });
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

    const result = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });

    expect(result.statements.some((statement) => statement.includes('DEFAULT'))).toBe(false);

    const client = await pool.connect();
    const columns = await client.query(
      "SELECT column_default FROM information_schema.columns WHERE table_name='numbers' AND column_name='value'"
    );
    client.release();

    expect(columns.rows[0]?.column_default).toBeNull();
  });

  it('introspects existing tables and relationships', async () => {
    const service = buildService();
    const pool = createInMemoryPool();

    const client = await pool.connect();
    await client.query(
      `CREATE TABLE users (
        id uuid PRIMARY KEY,
        email text UNIQUE NOT NULL,
        created_at timestamptz DEFAULT now()
      );`
    );
    await client.query(
      `CREATE TABLE orders (
        id uuid PRIMARY KEY,
        total numeric NOT NULL,
        user_id uuid REFERENCES users(id)
      );`
    );
    client.release();

    const result = await service.introspectSchema(
      'owner-1',
      'project-1',
      { connection, name: 'Remote DB', schemaId: 'db-remote' },
      { pool }
    );

    expect(result.schema.id).toBe('db-remote');
    expect(result.schema.name).toBe('Remote DB');
    expect(result.schema.tables).toHaveLength(2);

    const usersTable = result.schema.tables.find((table) => table.name === 'users');
    const ordersTable = result.schema.tables.find((table) => table.name === 'orders');

    expect(usersTable?.fields.find((field) => field.name === 'email')?.unique).toBe(true);
    expect(usersTable?.fields.find((field) => field.name === 'created_at')?.type).toBe('datetime');
    expect(usersTable?.fields.find((field) => field.isId)?.name).toBe('id');

    expect(ordersTable?.fields.find((field) => field.name === 'user_id')?.type).toBe('uuid');

    expect(result.schema.relationships).toHaveLength(1);
    expect(result.schema.relationships[0]).toMatchObject({
      sourceTableId: 'orders',
      targetTableId: 'users',
      cardinality: 'many',
      modality: 0
    });
  });

  it('rejects introspection when connection details are missing', async () => {
    const service = buildService();
    const invalidConnection: DatabaseConnectionSettings = { ...connection, host: '', database: '', user: '' };

    await expect(
      service.introspectSchema('owner-1', 'project-1', {
        connection: invalidConnection
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('surfaces connection errors during introspection', async () => {
    const service = buildService();
    const connect = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('password authentication failed'), { code: '28P01' }));
    const pool = { connect } as unknown as Pool;

    await expect(
      service.introspectSchema(
        'owner-1',
        'project-1',
        { connection },
        { pool }
      )
    ).rejects.toThrow('Unable to connect to database: password authentication failed');

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('includes underlying errors when introspection fails mid-query', async () => {
    const service = buildService();
    const pool = createInMemoryPool();
    const loadSpy = jest
      .spyOn(service as unknown as { loadTableNames: (client: PoolClient) => Promise<string[]> }, 'loadTableNames')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(
      service.introspectSchema(
        'owner-1',
        'project-1',
        { connection },
        { pool }
      )
    ).rejects.toThrow(DatabaseSchemaException);

    loadSpy.mockRestore();
  });

  it('handles multiple relationships to same target without FK column conflicts', async () => {
    const service = buildService();
    const pool = createInMemoryPool();

    const schema: DatabaseSchema = {
      id: 'db-multi-rel',
      name: 'Multi Relationship Test',
      tables: [
        {
          id: 'child',
          name: 'Child',
          fields: [
            { id: 'child-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        },
        {
          id: 'parent',
          name: 'Parent',
          fields: [
            { id: 'parent-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        },
        {
          id: 'grandparent',
          name: 'Grandparent',
          fields: [
            { id: 'gp-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        }
      ],
      relationships: [
        {
          id: 'rel_child_parent',
          sourceTableId: 'child',
          targetTableId: 'parent',
          cardinality: 'many',
          modality: 0
        },
        {
          id: 'rel_child_grandparent',
          sourceTableId: 'child',
          targetTableId: 'grandparent',
          cardinality: 'many',
          modality: 0
        }
      ],
      connection
    };

    const result = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });

    expect(result.statements.length).toBeGreaterThan(0);

    const client = await pool.connect();
    const childColumns = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='Child'"
    );
    client.release();

    const columnNames = childColumns.rows.map((row) => row.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('Parent_id');
    expect(columnNames).toContain('Grandparent_id');
  });

  it('generates unique FK column names for multiple relationships to same target', async () => {
    const service = buildService();
    const pool = createInMemoryPool();

    // Create a scenario where a table has multiple relationships to the same target table
    const schema: DatabaseSchema = {
      id: 'db-duplicate-fk',
      name: 'Duplicate FK Test',
      tables: [
        {
          id: 'order',
          name: 'orders',
          fields: [
            { id: 'order-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        },
        {
          id: 'user',
          name: 'users',
          fields: [
            { id: 'user-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        }
      ],
      relationships: [
        {
          id: 'rel_order_buyer',
          sourceTableId: 'order',
          targetTableId: 'user',
          cardinality: 'many',
          modality: 1
        },
        {
          id: 'rel_order_seller',
          sourceTableId: 'order',
          targetTableId: 'user',
          cardinality: 'many',
          modality: 0
        }
      ],
      connection
    };

    const result = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });

    expect(result.statements.length).toBeGreaterThan(0);

    const client = await pool.connect();
    const orderColumns = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='orders'"
    );
    client.release();

    const columnNames = orderColumns.rows.map((row) => row.column_name);
    expect(columnNames).toContain('id');
    // First relationship creates users_id
    expect(columnNames).toContain('users_id');
    // Second relationship should create users_id_1 to avoid conflict
    expect(columnNames).toContain('users_id_1');
  });

  it('throws DatabaseSchemaException with details on statement failure', async () => {
    const service = buildService();
    const pool = createInMemoryPool();

    // First, create a table with a unique constraint
    const client = await pool.connect();
    await client.query('CREATE TABLE test_unique (id uuid PRIMARY KEY, email TEXT UNIQUE);');
    await client.query("INSERT INTO test_unique VALUES ('11111111-1111-1111-1111-111111111111', 'test@test.com');");
    client.release();

    // Now try to apply a schema that adds the same data (simulating constraint violation)
    // We can't easily trigger this with our apply method, so let's test with a mock
    const queryMock = jest.fn()
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        detail: 'Key (email)=(test@test.com) already exists.',
        constraint: 'test_unique_email_key',
        table: 'test_unique',
        column: 'email'
      });

    const releaseMock = jest.fn();
    const endMock = jest.fn().mockResolvedValue(undefined);

    const mockPool = {
      connect: jest.fn().mockResolvedValue({
        query: queryMock,
        release: releaseMock
      }),
      end: endMock
    } as unknown as Pool;

    const schema: DatabaseSchema = {
      id: 'db-fail',
      name: 'Fail Test',
      tables: [
        {
          id: 't1',
          name: 'test',
          fields: [
            { id: 'f1', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        }
      ],
      relationships: [],
      connection
    };

    await expect(service.applySchema('owner-1', 'project-1', schema, { pool: mockPool, useSavepoints: false }))
      .rejects.toThrow(DatabaseSchemaException);

    try {
      await service.applySchema('owner-1', 'project-1', schema, { pool: mockPool, useSavepoints: false });
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseSchemaException);
      const dbError = error as DatabaseSchemaException;
      expect(dbError.details.pgCode).toBe('23505');
      expect(dbError.details.constraintName).toBe('test_unique_email_key');
    }
  });

  it('includes statement in error details when apply fails', async () => {
    const service = buildService();

    const queryMock = jest.fn()
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // CREATE TABLE
      .mockRejectedValueOnce({
        code: '42601',
        message: 'syntax error'
      });

    const releaseMock = jest.fn();
    const endMock = jest.fn().mockResolvedValue(undefined);

    const mockPool = {
      connect: jest.fn().mockResolvedValue({
        query: queryMock,
        release: releaseMock
      }),
      end: endMock
    } as unknown as Pool;

    const schema: DatabaseSchema = {
      id: 'db-syntax',
      name: 'Syntax Test',
      tables: [
        {
          id: 't1',
          name: 'test',
          fields: [
            { id: 'f1', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        }
      ],
      relationships: [],
      connection
    };

    try {
      await service.applySchema('owner-1', 'project-1', schema, { pool: mockPool, useSavepoints: false });
      fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseSchemaException);
      const dbError = error as DatabaseSchemaException;
      expect(dbError.details.pgCode).toBe('42601');
      expect(dbError.details.statement).toBeDefined();
    }
  });

  it('handles existing FK column in table fields without duplication', async () => {
    const service = buildService();
    const pool = createInMemoryPool();

    // Table already has a Parent_id field defined
    const schema: DatabaseSchema = {
      id: 'db-existing-fk',
      name: 'Existing FK Test',
      tables: [
        {
          id: 'child',
          name: 'Child',
          fields: [
            { id: 'child-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'child-parent', name: 'Parent_id', type: 'uuid', nullable: true, unique: false, isId: false }
          ]
        },
        {
          id: 'parent',
          name: 'Parent',
          fields: [
            { id: 'parent-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        }
      ],
      relationships: [
        {
          id: 'rel_child_parent',
          sourceTableId: 'child',
          targetTableId: 'parent',
          cardinality: 'many',
          modality: 0
        }
      ],
      connection
    };

    const result = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });

    expect(result.statements.length).toBeGreaterThan(0);

    const client = await pool.connect();
    const childColumns = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='Child'"
    );
    client.release();

    const columnNames = childColumns.rows.map((row) => row.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('Parent_id');
    // FK column reuse: when the table already has Parent_id as a FK field, the relationship
    // should reuse it rather than creating Parent_id_1
    // Only Parent_id should exist, NOT Parent_id_1
    expect(columnNames).not.toContain('Parent_id_1');
  });

  it('reuses existing FK column when relationship matches table field', async () => {
    const service = buildService();
    const pool = createInMemoryPool();

    // Table Child has Parent_id already defined as a field (like from introspection)
    // The relationship should reuse this field, not create a new one
    const schema: DatabaseSchema = {
      id: 'db-fk-reuse',
      name: 'FK Reuse Test',
      tables: [
        {
          id: 'child',
          name: 'Child',
          fields: [
            { id: 'child-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'child-parent-id', name: 'Parent_id', type: 'uuid', nullable: true, unique: false, isId: false }
          ]
        },
        {
          id: 'parent',
          name: 'Parent',
          fields: [
            { id: 'parent-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        }
      ],
      relationships: [
        {
          id: 'rel_child_parent',
          sourceTableId: 'child',
          targetTableId: 'parent',
          cardinality: 'many',
          modality: 0
        }
      ],
      connection
    };

    const result = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });

    // Should not create new column statements for Parent_id since it already exists
    // Only the initial ADD COLUMN IF NOT EXISTS from table creation should include Parent_id
    // The relationship should NOT add another Parent_id_1 column
    
    const client = await pool.connect();
    const childColumns = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='Child'"
    );
    client.release();

    const columnNames = childColumns.rows.map((row) => row.column_name);
    expect(columnNames).toContain('Parent_id');
    expect(columnNames).not.toContain('Parent_id_1');
    
    // FK constraint should still be created
    expect(result.statements.some((s) => s.includes('FOREIGN KEY') && s.includes('Parent_id'))).toBe(true);
  });

  // Note: This test requires a real PostgreSQL database with SAVEPOINT support
  // pg-mem does not support savepoints, so this test is skipped in unit tests
  // This functionality is tested in e2e tests with a real database
  it.skip('recovers from ignorable errors using savepoints', async () => {
    const service = buildService();
    const pool = createInMemoryPool();

    // First apply - creates tables
    const schema: DatabaseSchema = {
      id: 'db-savepoint',
      name: 'Savepoint Test',
      tables: [
        {
          id: 't1',
          name: 'test_table',
          fields: [
            { id: 'f1', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'f2', name: 'name', type: 'string', nullable: false, unique: false }
          ]
        }
      ],
      relationships: [],
      connection
    };

    // First apply should succeed
    const result1 = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });
    expect(result1.statements.length).toBeGreaterThan(0);

    // Second apply with same schema should succeed (duplicate objects are ignored via savepoints)
    const result2 = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });
    expect(result2.statements.length).toBeGreaterThan(0);

    // Verify table exists and is usable
    const client = await pool.connect();
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='test_table'"
    );
    client.release();
    expect(tables.rowCount).toBe(1);
  });

  // Note: This test requires a real PostgreSQL database
  // pg-mem has limitations with certain SQL features
  // This functionality is tested in e2e tests with a real database
  it.skip('handles re-applying schema with existing constraints', async () => {
    const service = buildService();
    const pool = createInMemoryPool();

    const schema: DatabaseSchema = {
      id: 'db-reapply',
      name: 'Reapply Test',
      tables: [
        {
          id: 'parent',
          name: 'Parent',
          fields: [
            { id: 'parent-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        },
        {
          id: 'child',
          name: 'Child',
          fields: [
            { id: 'child-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        }
      ],
      relationships: [
        {
          id: 'rel_child_parent',
          sourceTableId: 'child',
          targetTableId: 'parent',
          cardinality: 'many',
          modality: 0
        }
      ],
      connection
    };

    // First apply creates everything
    const result1 = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });
    expect(result1.statements.some((s) => s.includes('FOREIGN KEY'))).toBe(true);

    // Second apply should succeed even though constraint already exists
    // (recovered via savepoint)
    const result2 = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });
    expect(result2.statements.length).toBeGreaterThan(0);
  });

  it('handles connection failure with descriptive error', async () => {
    const service = buildService();

    const connectError = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    const mockPool = {
      connect: jest.fn().mockRejectedValue(connectError),
      end: jest.fn().mockResolvedValue(undefined)
    } as unknown as Pool;

    const schema: DatabaseSchema = {
      id: 'db-conn',
      name: 'Connection Test',
      tables: [
        {
          id: 't1',
          name: 'test',
          fields: [
            { id: 'f1', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        }
      ],
      relationships: [],
      connection
    };

    await expect(service.applySchema('owner-1', 'project-1', schema, { pool: mockPool }))
      .rejects.toThrow('Unable to connect to database: ECONNREFUSED');
  });

  it('validates relationship references existing tables', async () => {
    const service = buildService();
    const pool = createInMemoryPool();

    // Relationship references non-existent table IDs
    const schema: DatabaseSchema = {
      id: 'db-bad-rel',
      name: 'Bad Relationship Test',
      tables: [
        {
          id: 'users',
          name: 'users',
          fields: [
            { id: 'user-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true }
          ]
        }
      ],
      relationships: [
        {
          id: 'rel_orphan',
          sourceTableId: 'users',
          targetTableId: 'nonexistent',
          cardinality: 'many',
          modality: 0
        }
      ],
      connection
    };

    // This should work - invalid relationships are filtered out during normalization
    const result = await service.applySchema('owner-1', 'project-1', schema, { pool, useSavepoints: false });

    // The FK statements for invalid relationships should not be included
    const fkStatements = result.statements.filter((s) => s.includes('FOREIGN KEY'));
    expect(fkStatements).toHaveLength(0);
  });
});
