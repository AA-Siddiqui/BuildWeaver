import { HttpStatus } from '@nestjs/common';
import { DatabaseSchemaException, DatabaseSchemaErrorDetails } from './database-schema.exception';

describe('DatabaseSchemaException', () => {
  describe('constructor', () => {
    it('creates exception with message and default status', () => {
      const exception = new DatabaseSchemaException('Test error');

      expect(exception.message).toBe('Test error');
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(exception.details).toEqual({});
    });

    it('creates exception with custom status', () => {
      const exception = new DatabaseSchemaException('Bad request', {}, HttpStatus.BAD_REQUEST);

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('includes sanitized details in response', () => {
      const details: DatabaseSchemaErrorDetails = {
        schemaId: 'schema-123',
        statement: 'CREATE TABLE test',
        tableName: 'test',
        pgCode: '42P07'
      };

      const exception = new DatabaseSchemaException('Table exists', details);
      const response = exception.getResponse() as Record<string, unknown>;

      expect(response.message).toBe('Table exists');
      expect(response.error).toBe('Database Schema Error');
      expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(response.details).toEqual(details);
    });

    it('removes undefined and empty values from details', () => {
      const details: DatabaseSchemaErrorDetails = {
        schemaId: 'schema-123',
        tableName: undefined,
        fieldName: '',
        pgCode: '42P07',
        pgDetail: undefined,
        pgHint: null as unknown as string
      };

      const exception = new DatabaseSchemaException('Error', details);
      const response = exception.getResponse() as Record<string, unknown>;

      expect(response.details).toEqual({
        schemaId: 'schema-123',
        pgCode: '42P07'
      });
    });

    it('exposes details property on exception instance', () => {
      const details: DatabaseSchemaErrorDetails = {
        schemaId: 'db-1',
        statement: 'SELECT 1'
      };

      const exception = new DatabaseSchemaException('Error', details);

      expect(exception.details.schemaId).toBe('db-1');
      expect(exception.details.statement).toBe('SELECT 1');
    });
  });

  describe('fromPgError', () => {
    it('creates exception from PostgreSQL error with code', () => {
      const pgError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        detail: 'Key (email)=(test@test.com) already exists',
        constraint: 'users_email_key',
        table: 'users',
        column: 'email'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, { schemaId: 'db-1' });

      expect(exception.message).toBe('Unique constraint violation - duplicate value exists');
      expect(exception.details.pgCode).toBe('23505');
      expect(exception.details.pgDetail).toBe('Key (email)=(test@test.com) already exists');
      expect(exception.details.constraintName).toBe('users_email_key');
      expect(exception.details.tableName).toBe('users');
      expect(exception.details.fieldName).toBe('email');
      expect(exception.details.schemaId).toBe('db-1');
    });

    it('translates foreign key violation code', () => {
      const pgError = {
        code: '23503',
        message: 'insert or update on table "orders" violates foreign key constraint'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Foreign key constraint violation - referenced row not found');
    });

    it('translates NOT NULL violation code', () => {
      const pgError = {
        code: '23502',
        message: 'null value in column "name" of relation "users" violates not-null constraint'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('NOT NULL constraint violation - required field is missing');
    });

    it('translates table already exists code', () => {
      const pgError = {
        code: '42P07',
        message: 'relation "users" already exists'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Table already exists');
    });

    it('translates column does not exist code', () => {
      const pgError = {
        code: '42703',
        message: 'column "foo" does not exist'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Column does not exist');
    });

    it('translates authentication failure code', () => {
      const pgError = {
        code: '28P01',
        message: 'password authentication failed for user "test"'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Password authentication failed - check credentials');
    });

    it('translates connection errors', () => {
      const pgError = {
        code: '08000',
        message: 'could not connect to server'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Database connection failed');
    });

    it('translates type mismatch error', () => {
      const pgError = {
        code: '42804',
        message: 'column "age" is of type integer but expression is of type text'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Datatype mismatch');
    });

    it('translates permission denied error', () => {
      const pgError = {
        code: '42501',
        message: 'permission denied for table users'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Insufficient privilege - permission denied');
    });

    it('translates too many connections error', () => {
      const pgError = {
        code: '53300',
        message: 'too many connections for role "test"'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Too many connections to database');
    });

    it('uses original message for unknown error codes', () => {
      const pgError = {
        code: '99999',
        message: 'Some unknown error occurred'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Database error [99999]: Some unknown error occurred');
    });

    it('handles missing error code', () => {
      const pgError = {
        message: 'Something went wrong'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Database error [UNKNOWN]: Something went wrong');
      expect(exception.details.pgCode).toBeUndefined();
    });

    it('handles null error object', () => {
      const exception = DatabaseSchemaException.fromPgError(null, { schemaId: 'db-1' });

      expect(exception.message).toBe('Database error [UNKNOWN]: Unknown database error');
      expect(exception.details.schemaId).toBe('db-1');
    });

    it('preserves context details when creating from error', () => {
      const pgError = {
        code: '42703',
        message: 'column "missing" does not exist'
      };

      const context: DatabaseSchemaErrorDetails = {
        schemaId: 'db-123',
        statement: 'SELECT missing FROM users',
        tableName: 'existing_table'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, context);

      expect(exception.details.schemaId).toBe('db-123');
      expect(exception.details.statement).toBe('SELECT missing FROM users');
      // Table from context should be preserved since pgError has no table
      expect(exception.details.tableName).toBe('existing_table');
    });

    it('prefers PostgreSQL error table over context table', () => {
      const pgError = {
        code: '23502',
        message: 'null value violates not-null constraint',
        table: 'pg_table'
      };

      const context: DatabaseSchemaErrorDetails = {
        tableName: 'context_table'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, context);

      expect(exception.details.tableName).toBe('pg_table');
    });

    it('includes hint when available', () => {
      const pgError = {
        code: '42P01',
        message: 'relation "foo" does not exist',
        hint: 'Perhaps you meant to reference the table "bar".'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.details.pgHint).toBe('Perhaps you meant to reference the table "bar".');
    });

    it('includes original message in details', () => {
      const pgError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint "users_pkey"'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.details.originalMessage).toBe(
        'duplicate key value violates unique constraint "users_pkey"'
      );
    });
  });

  describe('common PostgreSQL error scenarios', () => {
    it('handles syntax error', () => {
      const pgError = {
        code: '42601',
        message: 'syntax error at or near "SELEC"'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('SQL syntax error');
    });

    it('handles database does not exist', () => {
      const pgError = {
        code: '3D000',
        message: 'database "nonexistent" does not exist'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Database does not exist');
    });

    it('handles object already exists', () => {
      const pgError = {
        code: '42710',
        message: 'constraint "fk_test" already exists'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Object already exists');
    });

    it('handles lock not available', () => {
      const pgError = {
        code: '55P03',
        message: 'could not obtain lock on relation "users"'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Lock not available - table is locked');
    });

    it('handles query cancelled', () => {
      const pgError = {
        code: '57014',
        message: 'canceling statement due to user request'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Query cancelled by user or timeout');
    });

    it('handles transaction aborted error', () => {
      const pgError = {
        code: '25P02',
        message: 'current transaction is aborted, commands ignored until end of transaction block'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Transaction aborted - a previous statement failed, please retry the operation');
    });

    it('handles duplicate column error', () => {
      const pgError = {
        code: '42701',
        message: 'column "email" of relation "users" already exists'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Duplicate column name in table');
    });

    it('handles duplicate table error', () => {
      const pgError = {
        code: '42P07',
        message: 'relation "users" already exists'
      };

      const exception = DatabaseSchemaException.fromPgError(pgError, {});

      expect(exception.message).toBe('Table already exists');
    });
  });
});
