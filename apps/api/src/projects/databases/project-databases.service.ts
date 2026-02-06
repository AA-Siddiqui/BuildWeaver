import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { Pool, PoolClient, PoolConfig } from 'pg';
import { projects } from '@buildweaver/db';
import type { DatabaseConnectionSettings, DatabaseField, DatabaseFieldType, DatabaseSchema, DatabaseTable } from '@buildweaver/libs';
import { DatabaseService } from '../../database/database.service';
import { DatabaseSchemaException } from './exceptions/database-schema.exception';

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface ApplySchemaResult {
  statements: string[];
}

export interface IntrospectSchemaResult {
  schema: DatabaseSchema;
}

@Injectable()
export class ProjectDatabasesService {
  private readonly logger = new Logger(ProjectDatabasesService.name);

  constructor(private readonly database: DatabaseService) {}

  async introspectSchema(
    ownerId: string,
    projectId: string,
    payload: { connection: DatabaseConnectionSettings; name?: string; schemaId?: string },
    options?: { pool?: Pool }
  ): Promise<IntrospectSchemaResult> {
    await this.assertProjectOwner(ownerId, projectId);
    const connection = this.validateConnectionSettings(payload?.connection);

    const pool = options?.pool ?? new Pool(this.toPoolConfig(connection));
    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
    } catch (error) {
      this.logger.error('Database connection failed during introspection', {
        projectId,
        host: connection.host,
        database: connection.database,
        code: (error as { code?: string } | undefined)?.code,
        message: error instanceof Error ? error.message : error
      });
      throw new BadRequestException(
        `Unable to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    this.logger.log('Starting database schema introspection', {
      projectId,
      host: connection.host,
      database: connection.database
    });

    try {
      const tableNames = await this.loadTableNames(client);
      this.logger.debug('Discovered tables during introspection', {
        projectId,
        schemaId: payload.schemaId,
        tableNames
      });
      if (!tableNames.length) {
        this.logger.warn('No tables discovered during introspection', {
          projectId,
          host: connection.host,
          database: connection.database
        });
      }

      const tables = await Promise.all(tableNames.map((tableName) => this.loadTableDefinition(client, tableName)));
      const relationships = await this.loadRelationships(client, tables);
      const schema: DatabaseSchema = {
        id: payload.schemaId || `db-${randomUUID()}`,
        name: payload.name?.trim() || connection.database || 'Database',
        tables,
        relationships,
        connection,
        updatedAt: new Date().toISOString()
      };

      this.logger.log('Database schema introspected', {
        projectId,
        schemaId: schema.id,
        tableCount: schema.tables.length,
        relationshipCount: schema.relationships.length,
        host: connection.host,
        database: connection.database
      });

      return { schema };
    } catch (error) {
      const pgError = error as { code?: string; detail?: string; message?: string };
      this.logger.error('Database introspection failed', {
        projectId,
        host: connection.host,
        database: connection.database,
        pgCode: pgError.code,
        pgDetail: pgError.detail,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      if (error instanceof BadRequestException || error instanceof DatabaseSchemaException) {
        throw error;
      }
      throw DatabaseSchemaException.fromPgError(error, {
        schemaId: payload.schemaId
      });
    } finally {
      if (client) {
        client.release();
      }
      if (!options?.pool) {
        await pool.end().catch((endError) =>
          this.logger.error('Failed to close database pool after introspection', {
            projectId,
            message: endError instanceof Error ? endError.message : endError
          })
        );
      }
    }
  }

  async applySchema(ownerId: string, projectId: string, schema: DatabaseSchema, options?: { pool?: Pool; useSavepoints?: boolean }): Promise<ApplySchemaResult> {
    await this.assertProjectOwner(ownerId, projectId);
    const normalized = this.normalizeSchema(schema);
    const connection = this.validateConnectionSettings(normalized.connection);

    const statements = this.buildStatements(normalized);
    if (!statements.length) {
      this.logger.warn('No statements generated for schema apply', { schemaId: normalized.id });
      return { statements: [] };
    }

    const pool = options?.pool ?? new Pool(this.toPoolConfig(connection));
    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
    } catch (error) {
      this.logger.error('Database connection failed during apply', {
        schemaId: normalized.id,
        host: connection.host,
        database: connection.database,
        code: (error as { code?: string } | undefined)?.code,
        message: error instanceof Error ? error.message : error
      });
      throw new BadRequestException(
        `Unable to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    let currentStatement = '';
    let statementIndex = 0;
    let failedStatementInfo: { index: number; statement: string; error: string } | null = null;
    
    // Determine if savepoints should be used
    // In production (real PostgreSQL), we default to using savepoints for better error recovery
    // In tests (pg-mem), savepoints may not be supported, so we allow disabling them
    const useSavepoints = options?.useSavepoints ?? true;
    
    try {
      await client.query('BEGIN');
      this.logger.log('Starting schema apply transaction', {
        schemaId: normalized.id,
        statementCount: statements.length,
        useSavepoints
      });

      // Test if savepoints are supported (for pg-mem compatibility)
      let savepointsSupported = useSavepoints;
      if (useSavepoints) {
        try {
          await client.query('SAVEPOINT sp_test');
          await client.query('RELEASE SAVEPOINT sp_test');
        } catch {
          savepointsSupported = false;
          this.logger.debug('Savepoints not supported, falling back to simple execution', {
            schemaId: normalized.id
          });
        }
      }

      for (const statement of statements) {
        currentStatement = statement;
        statementIndex++;
        
        const savepointName = `sp_${statementIndex}`;
        this.logger.debug('Executing schema apply statement', {
          schemaId: normalized.id,
          statementIndex,
          totalStatements: statements.length,
          statement
        });
        
        try {
          if (savepointsSupported) {
            // Create savepoint before each statement to allow recovery from ignorable errors
            await client.query(`SAVEPOINT ${savepointName}`);
          }
          await client.query(statement);
          if (savepointsSupported) {
            // Release savepoint on success to free resources
            await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          }
          this.logger.debug('Statement executed successfully', {
            schemaId: normalized.id,
            statementIndex
          });
        } catch (error) {
          const pgError = error as {
            code?: string;
            detail?: string;
            hint?: string;
            message?: string;
            constraint?: string;
            table?: string;
            column?: string;
          };

          if (this.shouldIgnoreConstraintError(error)) {
            if (savepointsSupported) {
              // Rollback to savepoint to recover from the error
              await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
            }
            this.logger.debug('Ignoring constraint error and continuing', {
              schemaId: normalized.id,
              statementIndex,
              statement,
              pgCode: pgError.code,
              reason: this.getIgnoreReason(error)
            });
            continue;
          }

          // Track the first failing statement for better error reporting
          if (!failedStatementInfo) {
            failedStatementInfo = {
              index: statementIndex,
              statement,
              error: pgError.message ?? 'Unknown error'
            };
          }

          this.logger.error('Statement failed during schema apply', {
            schemaId: normalized.id,
            host: connection.host,
            database: connection.database,
            statementIndex,
            totalStatements: statements.length,
            statement,
            pgCode: pgError.code,
            pgDetail: pgError.detail,
            pgHint: pgError.hint,
            pgConstraint: pgError.constraint,
            pgTable: pgError.table,
            pgColumn: pgError.column,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });

          throw DatabaseSchemaException.fromPgError(error, {
            schemaId: normalized.id,
            statement,
            tableName: pgError.table,
            fieldName: pgError.column,
            constraintName: pgError.constraint
          });
        }
      }
      await client.query('COMMIT');
      this.logger.log('Database schema applied successfully', {
        schemaId: normalized.id,
        host: connection.host,
        database: connection.database,
        statementsExecuted: statements.length
      });
      return { statements };
    } catch (error) {
      await this.safeRollback(client, normalized.id);

      // If it's already our exception, just rethrow
      if (error instanceof DatabaseSchemaException) {
        throw error;
      }

      const pgError = error as { code?: string; detail?: string; message?: string };
      this.logger.error('Database schema apply failed', {
        schemaId: normalized.id,
        host: connection.host,
        database: connection.database,
        failedStatementIndex: statementIndex,
        failedStatement: currentStatement,
        firstFailure: failedStatementInfo,
        pgCode: pgError.code,
        pgDetail: pgError.detail,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      throw DatabaseSchemaException.fromPgError(error, {
        schemaId: normalized.id,
        statement: currentStatement
      });
    } finally {
      if (client) {
        client.release();
      }
      if (!options?.pool) {
        await pool.end().catch((endError) =>
          this.logger.error('Failed to close database pool after apply', {
            schemaId: normalized.id,
            message: endError instanceof Error ? endError.message : endError
          })
        );
      }
    }
  }

  private validateConnectionSettings(connection?: DatabaseConnectionSettings): DatabaseConnectionSettings {
    if (!connection) {
      throw new BadRequestException('Connection details are required');
    }

    const host = connection.host?.trim();
    const database = connection.database?.trim();
    const user = connection.user?.trim();
    const port = Number(connection.port);

    if (!host) {
      this.logger.warn('Database connection rejected - missing host');
      throw new BadRequestException('Database host is required');
    }
    if (!database) {
      this.logger.warn('Database connection rejected - missing database name', { host });
      throw new BadRequestException('Database name is required');
    }
    if (!user) {
      this.logger.warn('Database connection rejected - missing user', { host, database });
      throw new BadRequestException('Database user is required');
    }
    if (!Number.isFinite(port) || port <= 0) {
      this.logger.warn('Database connection rejected - invalid port', { host, database, port });
      throw new BadRequestException('Database port must be a positive number');
    }

    return {
      ...connection,
      host,
      database,
      user,
      port,
      ssl: Boolean(connection.ssl)
    } satisfies DatabaseConnectionSettings;
  }

  private toPoolConfig(connection: DatabaseConnectionSettings): PoolConfig {
    return {
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.user,
      password: connection.password,
      ssl: connection.ssl ? { rejectUnauthorized: false } : false
    } satisfies PoolConfig;
  }

  private async assertProjectOwner(ownerId: string, projectId: string): Promise<void> {
    const [project] = await this.database.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
      .limit(1);

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private normalizeSchema(schema: DatabaseSchema): DatabaseSchema {
    if (!schema) {
      throw new BadRequestException('Schema payload is required');
    }
    const tables = (schema.tables ?? []).map((table, index) => this.normalizeTable(table, index));
    if (!tables.length) {
      throw new BadRequestException('At least one table is required');
    }
    const tableIds = new Set(tables.map((table) => table.id));
    const relationships = (schema.relationships ?? []).filter((relationship) => {
      if (!relationship) {
        return false;
      }
      const valid = tableIds.has(relationship.sourceTableId) && tableIds.has(relationship.targetTableId);
      if (!valid) {
        this.logger.warn('Dropping relationship with missing table reference', {
          relationshipId: relationship.id,
          sourceTableId: relationship.sourceTableId,
          targetTableId: relationship.targetTableId
        });
      }
      return valid;
    });

    const connection = schema.connection;
    if (!connection) {
      throw new BadRequestException('Connection is required');
    }

    return {
      ...schema,
      name: schema.name?.trim() || 'Database',
      tables,
      relationships,
      connection
    } satisfies DatabaseSchema;
  }

  private normalizeTable(table: DatabaseTable, tableIndex: number): DatabaseTable {
    const tableId = table?.id || `table_${tableIndex}`;
    const normalizedFields = this.normalizeFields(table.fields ?? [], tableId);
    const hasIdField = normalizedFields.some((field) => field.isId);
    const fields = hasIdField
      ? normalizedFields.map((field) => (field.isId ? { ...field, nullable: false, unique: true } : field))
      : [
          {
            id: `${tableId}_id`,
            name: 'id',
            type: 'uuid',
            nullable: false,
            unique: true,
            isId: true
          } satisfies DatabaseField,
          ...normalizedFields
        ];

    return {
      ...table,
      id: tableId,
      name: this.ensureValidIdentifier(table?.name || `table_${tableIndex + 1}`, 'table'),
      fields,
      position: table.position
    } satisfies DatabaseTable;
  }

  private normalizeFields(fields: DatabaseField[], tableId: string): DatabaseField[] {
    return (fields ?? []).map((field, fieldIndex) => {
      const name = this.ensureValidIdentifier(field?.name || `field_${fieldIndex + 1}`, 'field');
      return {
        ...field,
        id: field?.id || `${tableId}_field_${fieldIndex}`,
        name,
        type: field?.type ?? 'uuid',
        nullable: Boolean(field?.nullable),
        unique: Boolean(field?.unique),
        defaultValue: field?.defaultValue ?? undefined,
        isId: Boolean(field?.isId)
      } satisfies DatabaseField;
    });
  }

  private buildStatements(schema: DatabaseSchema): string[] {
    const statements: string[] = [];
    const tableMap = new Map(schema.tables.map((table) => [table.id, table]));
    // Track FK columns per source table to avoid naming conflicts
    const fkColumnTracker = new Map<string, Set<string>>();

    this.logger.debug('Building SQL statements for schema', {
      schemaId: schema.id,
      tableCount: schema.tables.length,
      relationshipCount: schema.relationships?.length ?? 0
    });

    for (const table of schema.tables) {
      this.logger.debug('Building statements for table', {
        schemaId: schema.id,
        tableId: table.id,
        tableName: table.name,
        fieldCount: table.fields.length
      });
      statements.push(this.buildCreateTableStatement(table));
      for (const field of table.fields) {
        statements.push(this.buildAddColumnStatement(table.name, field));
        if (field.unique && !field.isId) {
          statements.push(this.buildUniqueIndexStatement(table.name, field.name));
        }
        if (!field.nullable) {
          statements.push(this.buildNotNullStatement(table.name, field.name));
        }
      }
      // Initialize FK column tracker for each table
      fkColumnTracker.set(table.id, new Set(table.fields.map((f) => f.name)));
    }

    for (const relationship of schema.relationships ?? []) {
      this.logger.debug('Building statements for relationship', {
        schemaId: schema.id,
        relationshipId: relationship.id,
        sourceTableId: relationship.sourceTableId,
        targetTableId: relationship.targetTableId,
        cardinality: relationship.cardinality,
        modality: relationship.modality
      });
      const relationshipStatements = this.buildRelationshipStatements(relationship, tableMap, fkColumnTracker);
      statements.push(...relationshipStatements);
    }

    this.logger.debug('Built SQL statements', {
      schemaId: schema.id,
      statementCount: statements.length
    });

    return statements;
  }

  private buildCreateTableStatement(table: DatabaseTable): string {
    const columnDefinitions = table.fields.map((field) => this.buildColumnDefinition(field)).join(', ');
    const primaryKeys = table.fields.filter((field) => field.isId).map((field) => this.quoteIdentifier(field.name));
    const primaryKeyClause = primaryKeys.length ? `, PRIMARY KEY (${primaryKeys.join(', ')})` : '';
    return `CREATE TABLE IF NOT EXISTS ${this.quoteIdentifier(table.name)} (${columnDefinitions}${primaryKeyClause});`;
  }

  private buildAddColumnStatement(tableName: string, field: DatabaseField): string {
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD COLUMN IF NOT EXISTS ${this.buildColumnDefinition(field)};`;
  }

  private buildNotNullStatement(tableName: string, fieldName: string): string {
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} ALTER COLUMN ${this.quoteIdentifier(fieldName)} SET NOT NULL;`;
  }

  private buildUniqueIndexStatement(tableName: string, fieldName: string): string {
    const indexName = this.ensureValidIdentifier(`${tableName}_${fieldName}_uniq`, 'index');
    return `CREATE UNIQUE INDEX IF NOT EXISTS ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(tableName)} (${this.quoteIdentifier(fieldName)});`;
  }

  private buildRelationshipStatements(
    relationship: DatabaseSchema['relationships'][number],
    tableMap: Map<string, DatabaseTable>,
    fkColumnTracker: Map<string, Set<string>>
  ): string[] {
    const sourceTable = tableMap.get(relationship.sourceTableId);
    const targetTable = tableMap.get(relationship.targetTableId);
    if (!sourceTable || !targetTable) {
      this.logger.warn('Skipping relationship - missing source or target table', {
        relationshipId: relationship.id,
        sourceTableId: relationship.sourceTableId,
        targetTableId: relationship.targetTableId,
        sourceFound: !!sourceTable,
        targetFound: !!targetTable
      });
      return [];
    }

    const targetIdField =
      targetTable.fields.find((field) => field.isId) ??
      targetTable.fields.find((field) => field.name.toLowerCase() === 'id') ??
      targetTable.fields[0];
    if (!targetIdField) {
      this.logger.warn('Skipping relationship - target table has no ID field', {
        relationshipId: relationship.id,
        targetTableId: relationship.targetTableId,
        targetTableName: targetTable.name
      });
      return [];
    }

    const existingColumns = fkColumnTracker.get(sourceTable.id) ?? new Set<string>();
    const baseFkName = this.ensureValidIdentifier(`${targetTable.name}_id`, 'field');

    // Check if there's an existing field in the source table that matches the FK pattern
    // This handles the case where the FK column was already defined in the table schema
    const matchingNameField = sourceTable.fields.find((field) => {
      const nameMatches =
        field.name === baseFkName ||
        (field.name.toLowerCase().endsWith('_id') && field.name.toLowerCase().includes(targetTable.name.toLowerCase()));
      return nameMatches && !field.isId;
    });
    const typeMatches = matchingNameField ? matchingNameField.type === targetIdField.type : false;

    let fkFieldName: string;
    let needsColumnCreation = true;

    if (matchingNameField && typeMatches) {
      // Reuse existing FK column - don't create a new one
      fkFieldName = matchingNameField.name;
      needsColumnCreation = false;
      this.logger.debug('Reusing existing FK column for relationship', {
        relationshipId: relationship.id,
        sourceTable: sourceTable.name,
        targetTable: targetTable.name,
        existingFkColumn: fkFieldName,
        targetIdField: targetIdField.name
      });
    } else {
      if (matchingNameField && !typeMatches) {
        this.logger.warn('Existing FK column type mismatch; creating a new FK column', {
          relationshipId: relationship.id,
          sourceTable: sourceTable.name,
          targetTable: targetTable.name,
          existingFkColumn: matchingNameField.name,
          existingType: matchingNameField.type,
          expectedType: targetIdField.type
        });
      }
      // Generate a unique FK column name to avoid conflicts
      fkFieldName = baseFkName;
      let suffix = 1;

      // If the base name already exists (and wasn't matched as FK field), append a suffix
      while (existingColumns.has(fkFieldName)) {
        fkFieldName = this.ensureValidIdentifier(`${targetTable.name}_id_${suffix}`, 'field');
        suffix++;
        if (suffix > 100) {
          this.logger.error('Too many FK columns with same base name', {
            relationshipId: relationship.id,
            sourceTableId: sourceTable.id,
            baseFkName
          });
          throw new BadRequestException(
            `Cannot create FK column: too many relationships from ${sourceTable.name} to ${targetTable.name}`
          );
        }
      }

      // Track the new FK column name
      existingColumns.add(fkFieldName);

      this.logger.debug('Creating new FK column for relationship', {
        relationshipId: relationship.id,
        sourceTable: sourceTable.name,
        targetTable: targetTable.name,
        fkColumnName: fkFieldName,
        targetIdField: targetIdField.name
      });
    }

    const statements: string[] = [];

    // Only add column creation statements if the column doesn't already exist
    if (needsColumnCreation) {
      const fkField: DatabaseField = {
        id: `${relationship.id}_fk`,
        name: fkFieldName,
        type: targetIdField.type,
        nullable: relationship.modality === 0,
        unique: relationship.cardinality === 'one',
        isId: false
      };

      statements.push(this.buildAddColumnStatement(sourceTable.name, fkField));
      if (!fkField.nullable) {
        statements.push(this.buildNotNullStatement(sourceTable.name, fkField.name));
      }
      if (fkField.unique) {
        statements.push(this.buildUniqueIndexStatement(sourceTable.name, fkField.name));
      }
    }

    // Always add the FK constraint (it will be skipped if it already exists via savepoint recovery)
    const constraintName = this.ensureValidIdentifier(`${relationship.id}_fk`, 'constraint');
    const constraintClause = `FOREIGN KEY (${this.quoteIdentifier(fkFieldName)}) REFERENCES ${this.quoteIdentifier(targetTable.name)} (${this.quoteIdentifier(targetIdField.name)}) ON DELETE ${relationship.modality === 0 ? 'SET NULL' : 'CASCADE'}`;
    statements.push(this.buildConstraintIfMissing(sourceTable.name, constraintName, constraintClause));

    this.logger.debug('Built relationship statements', {
      relationshipId: relationship.id,
      sourceTable: sourceTable.name,
      targetTable: targetTable.name,
      fkColumnName: fkFieldName,
      needsColumnCreation,
      statementCount: statements.length
    });

    return statements;
  }

  private buildConstraintIfMissing(tableName: string, constraintName: string, clause: string): string {
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD CONSTRAINT ${this.quoteIdentifier(constraintName)} ${clause};`;
  }


  private async loadTableNames(client: PoolClient): Promise<string[]> {
    const result = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
    );
    return result.rows.map((row) => row.table_name).filter(Boolean);
  }

  private async loadTableDefinition(client: PoolClient, tableName: string): Promise<DatabaseTable> {
    const columns = await this.loadColumns(client, tableName);
    const primaryKeys = await this.loadPrimaryKeyColumns(client, tableName);
    const uniqueColumns = await this.loadUniqueColumns(client, tableName);

    if (primaryKeys.size === 0) {
      const primaryCandidate = columns.find((column) => column.column_name.toLowerCase() === 'id');
      if (primaryCandidate) {
        primaryKeys.add(primaryCandidate.column_name);
      }
    }

    if (uniqueColumns.size === 0) {
      for (const column of columns) {
        const lower = column.column_name.toLowerCase();
        if (lower === 'id' || lower.includes('email')) {
          uniqueColumns.add(column.column_name);
        }
      }
    }

    const fields: DatabaseField[] = columns.map((column) => {
      const isId = primaryKeys.has(column.column_name);
      const isUnique = uniqueColumns.has(column.column_name) || isId;
      return {
        id: `${tableName}_${column.column_name}`,
        name: column.column_name,
        type: this.resolveFieldType(column.data_type, column.udt_name),
        nullable: column.is_nullable === 'YES',
        unique: isUnique,
        isId,
        defaultValue: column.column_default ?? undefined
      } satisfies DatabaseField;
    });

    this.logger.debug('Loaded table definition', {
      tableName,
      columnCount: columns.length,
      primaryKeyCount: primaryKeys.size,
      uniqueColumnCount: uniqueColumns.size
    });

    return {
      id: tableName,
      name: tableName,
      fields
    } satisfies DatabaseTable;
  }

  private async loadColumns(
    client: PoolClient,
    tableName: string
  ): Promise<Array<{ column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null }>> {
    const result = await client.query(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [tableName]
    );
    return result.rows;
  }

  private async loadPrimaryKeyColumns(client: PoolClient, tableName: string): Promise<Set<string>> {
    const result = await client.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1`,
      [tableName]
    );
    return new Set(result.rows.map((row) => row.column_name));
  }

  private async loadUniqueColumns(client: PoolClient, tableName: string): Promise<Set<string>> {
    const unique = new Set<string>();

    const constraintResult = await client.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public' AND tc.table_name = $1`,
      [tableName]
    );
    constraintResult.rows.forEach((row) => unique.add(row.column_name));

    const constraintUsageResult = await client.query(
      `SELECT ccu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
       WHERE tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY') AND tc.table_schema = 'public' AND tc.table_name = $1`,
      [tableName]
    );
    constraintUsageResult.rows.forEach((row) => unique.add(row.column_name));

    const looseConstraintUsage = await client.query(
      `SELECT column_name FROM information_schema.constraint_column_usage WHERE table_schema = 'public' AND table_name = $1`,
      [tableName]
    );
    looseConstraintUsage.rows.forEach((row) => unique.add(row.column_name));

    try {
      const catalogResult = await client.query(
        `SELECT att.attname AS column_name
         FROM pg_constraint con
         JOIN pg_class cls ON cls.oid = con.conrelid
         JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
         JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
         WHERE con.contype IN ('u', 'p') AND cls.relname = $1 AND nsp.nspname = 'public'`,
        [tableName]
      );
      catalogResult.rows.forEach((row) => unique.add(row.column_name));
    } catch (error) {
      this.logger.debug('Unique constraint lookup skipped', {
        tableName,
        message: error instanceof Error ? error.message : error
      });
    }

    try {
      const definitionResult = await client.query(
        `SELECT pg_get_constraintdef(con.oid) AS definition
         FROM pg_constraint con
         JOIN pg_class cls ON cls.oid = con.conrelid
         JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
         WHERE con.contype = 'u' AND cls.relname = $1 AND nsp.nspname = 'public'`,
        [tableName]
      );
      definitionResult.rows.forEach((row) => {
        const definition = (row.definition as string | undefined) ?? '';
        const match = definition.match(/\(([^)]+)\)/);
        if (!match?.[1]) {
          return;
        }
        const columns = match[1]
          .split(',')
          .map((value) => value.trim().replace(/"/g, ''))
          .filter(Boolean);
        columns.forEach((column) => unique.add(column));
      });
    } catch (error) {
      this.logger.debug('Unique constraint definition lookup skipped', {
        tableName,
        message: error instanceof Error ? error.message : error
      });
    }

    try {
      const indexResult = await client.query(
        `SELECT att.attname AS column_name
         FROM pg_index idx
         JOIN pg_class cls ON cls.oid = idx.indrelid
         JOIN pg_attribute att ON att.attrelid = cls.oid AND att.attnum = ANY(idx.indkey)
         JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
         WHERE idx.indisunique = true AND cls.relname = $1 AND nsp.nspname = 'public'`,
        [tableName]
      );

      indexResult.rows.forEach((row) => unique.add(row.column_name));
    } catch (error) {
      this.logger.debug('Unique index catalog lookup skipped', {
        tableName,
        message: error instanceof Error ? error.message : error
      });
    }

    return unique;
  }

  private async loadRelationships(client: PoolClient, tables: DatabaseTable[]): Promise<DatabaseSchema['relationships']> {
    if (!tables.length) {
      return [];
    }
    const tableIds = new Set(tables.map((table) => table.id));
    const uniqueColumnsByTable = new Map<string, Set<string>>();
    for (const table of tables) {
      uniqueColumnsByTable.set(table.id, new Set(table.fields.filter((field) => field.unique).map((field) => field.name)));
    }

    const result = await client.query(
      `SELECT tc.constraint_name,
              kcu.table_name AS source_table,
              kcu.column_name AS source_column,
              ccu.table_name AS target_table,
              ccu.column_name AS target_column,
              cols.is_nullable AS source_nullable
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       LEFT JOIN information_schema.columns cols ON cols.table_schema = kcu.table_schema AND cols.table_name = kcu.table_name AND cols.column_name = kcu.column_name
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
    );

    const relationships = result.rows
      .filter((row) => tableIds.has(row.source_table) && tableIds.has(row.target_table))
      .map((row) => {
        const sourceUnique = uniqueColumnsByTable.get(row.source_table) ?? new Set<string>();
        const modality: DatabaseSchema['relationships'][number]['modality'] = row.source_nullable === 'YES' ? 0 : 1;
        const cardinality: DatabaseSchema['relationships'][number]['cardinality'] = sourceUnique.has(row.source_column) ? 'one' : 'many';
        return {
          id: row.constraint_name,
          sourceTableId: row.source_table,
          targetTableId: row.target_table,
          cardinality,
          modality,
          description: `FK ${row.constraint_name}: ${row.source_table}.${row.source_column} -> ${row.target_table}.${row.target_column}`
        };
      });

    if (relationships.length) {
      return relationships;
    }

    this.logger.warn('No FK constraints discovered; using heuristic relationships', {
      tableCount: tables.length
    });

    const tableMap = new Map(tables.map((table) => [table.name, table]));
    const fallback: DatabaseSchema['relationships'] = [];

    for (const table of tables) {
      for (const field of table.fields) {
        if (!field.name.endsWith('_id')) {
          continue;
        }

        const baseName = field.name.slice(0, -3);
        const targetTable = tableMap.get(baseName) || tableMap.get(`${baseName}s`) || tableMap.get(`${baseName}es`);
        if (!targetTable) {
          continue;
        }

        fallback.push({
          id: `${table.id}_${field.name}_fk`,
          sourceTableId: table.id,
          targetTableId: targetTable.id,
          cardinality: field.unique ? 'one' : 'many',
          modality: 0,
          description: `Heuristic FK ${table.name}.${field.name} -> ${targetTable.name}.id`
        });
      }
    }

    return fallback;
  }

  private resolveFieldType(dataType: string, udtName: string): DatabaseFieldType {
    const normalized = dataType.toLowerCase();
    const udt = (udtName || '').toLowerCase();

    if (normalized.includes('uuid') || udt === 'uuid') {
      return 'uuid';
    }
    if (normalized.includes('int') || normalized.includes('numeric') || normalized.includes('double')) {
      return 'number';
    }
    if (normalized.includes('bool')) {
      return 'boolean';
    }
    if (normalized.includes('json')) {
      return 'json';
    }
    if (normalized.includes('timestamp')) {
      return 'datetime';
    }
    if (normalized === 'date') {
      return 'date';
    }
    return 'string';
  }

  private buildColumnDefinition(field: DatabaseField): string {
    const parts = [this.quoteIdentifier(field.name), this.resolveSqlType(field.type)];
    if (!field.nullable) {
      parts.push('NOT NULL');
    }
    if (field.unique && !field.isId) {
      parts.push('UNIQUE');
    }
    const defaultValue = this.serializeDefault(field);
    if (defaultValue) {
      parts.push(`DEFAULT ${defaultValue}`);
    }
    return parts.join(' ');
  }

  private resolveSqlType(type: DatabaseFieldType): string {
    switch (type) {
      case 'uuid':
        return 'UUID';
      case 'string':
        return 'TEXT';
      case 'number':
        return 'DOUBLE PRECISION';
      case 'boolean':
        return 'BOOLEAN';
      case 'json':
        return 'JSONB';
      case 'date':
        return 'DATE';
      case 'datetime':
        return 'TIMESTAMPTZ';
      default:
        return 'TEXT';
    }
  }

  private serializeDefault(field: DatabaseField): string | null {
    if (typeof field.defaultValue === 'undefined' || field.defaultValue === null) {
      return null;
    }
    if (typeof field.defaultValue === 'string' && field.defaultValue.trim().length === 0) {
      return null;
    }
    if (typeof field.defaultValue === 'number' || typeof field.defaultValue === 'boolean') {
      return `${field.defaultValue}`;
    }
    if (typeof field.defaultValue === 'string') {
      const escaped = field.defaultValue.replace(/'/g, "''");
      if (field.type === 'uuid') {
        return `'${escaped}'::uuid`;
      }
      if (field.type === 'json') {
        return `'${escaped}'::jsonb`;
      }
      if (field.type === 'date') {
        return `'${escaped}'::date`;
      }
      if (field.type === 'datetime') {
        return `'${escaped}'::timestamptz`;
      }
      return `'${escaped}'`;
    }
    throw new BadRequestException(`Unsupported default value for field ${field.name}`);
  }

  private ensureValidIdentifier(value: string, kind: string): string {
    const trimmed = value.trim();
    const normalized = trimmed.replace(/[^A-Za-z0-9_]/g, '_');
    const prefixed = IDENTIFIER_PATTERN.test(normalized)
      ? normalized
      : normalized.replace(/^[^A-Za-z_]+/, '').replace(/^$/, '_');
    const collapsed = prefixed.replace(/_{2,}/g, '_');

    if (!IDENTIFIER_PATTERN.test(collapsed)) {
      throw new BadRequestException(`Invalid ${kind} name: ${value}`);
    }

    return collapsed;
  }

  private quoteIdentifier(value: string): string {
    return `"${value}"`;
  }

  private async safeRollback(client: PoolClient, schemaId: string): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch (error) {
      this.logger.error('Rollback after apply failed', {
        schemaId,
        message: error instanceof Error ? error.message : error
      });
    }
  }

  private shouldIgnoreConstraintError(error: unknown): boolean {
    const code = (error as { code?: string } | undefined)?.code;
    const message = (error as Error | undefined)?.message?.toLowerCase() ?? '';
    
    // 42710 - duplicate_object (constraint already exists)
    // 42P07 - duplicate_table (table already exists) 
    // 42701 - duplicate_column (column already exists)
    if (code === '42710' || code === '42P07' || code === '42701') {
      return true;
    }
    
    return message.includes('already exists');
  }

  private getIgnoreReason(error: unknown): string {
    const code = (error as { code?: string } | undefined)?.code;
    const message = (error as Error | undefined)?.message?.toLowerCase() ?? '';
    
    if (code === '42710') {
      return 'constraint already exists';
    }
    if (code === '42P07') {
      return 'table already exists';
    }
    if (code === '42701') {
      return 'column already exists';
    }
    if (message.includes('already exists')) {
      return `object already exists: ${message}`;
    }
    return 'unknown ignorable error';
  }
}
