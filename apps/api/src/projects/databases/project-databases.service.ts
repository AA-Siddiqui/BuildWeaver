import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Pool, PoolClient, PoolConfig } from 'pg';
import { projects } from '@buildweaver/db';
import type { DatabaseConnectionSettings, DatabaseField, DatabaseFieldType, DatabaseSchema, DatabaseTable } from '@buildweaver/libs';
import { DatabaseService } from '../../database/database.service';

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface ApplySchemaResult {
  statements: string[];
}

@Injectable()
export class ProjectDatabasesService {
  private readonly logger = new Logger(ProjectDatabasesService.name);

  constructor(private readonly database: DatabaseService) {}

  async applySchema(ownerId: string, projectId: string, schema: DatabaseSchema, options?: { pool?: Pool }): Promise<ApplySchemaResult> {
    await this.assertProjectOwner(ownerId, projectId);
    const normalized = this.normalizeSchema(schema);
    if (!normalized.connection) {
      throw new BadRequestException('Connection details are required to apply the schema');
    }

    const statements = this.buildStatements(normalized);
    if (!statements.length) {
      this.logger.warn('No statements generated for schema apply', { schemaId: normalized.id });
      return { statements: [] };
    }

    const pool = options?.pool ?? new Pool(this.toPoolConfig(normalized.connection));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const statement of statements) {
        this.logger.debug('Executing schema apply statement', {
          schemaId: normalized.id,
          statement
        });
        try {
          await client.query(statement);
        } catch (error) {
          if (this.shouldIgnoreConstraintError(error)) {
            this.logger.debug('Skipping duplicate constraint during apply', {
              schemaId: normalized.id,
              statement
            });
            continue;
          }
          this.logger.error('Statement failed during schema apply', {
            schemaId: normalized.id,
            host: normalized.connection.host,
            database: normalized.connection.database,
            statement,
            error: error instanceof Error ? error.message : error,
            code: (error as { code?: string } | undefined)?.code
          });
          throw error;
        }
      }
      await client.query('COMMIT');
      this.logger.log('Database schema applied', {
        schemaId: normalized.id,
        host: normalized.connection.host,
        database: normalized.connection.database,
        statements: statements.length
      });
      return { statements };
    } catch (error) {
      await this.safeRollback(client, normalized.id);
      this.logger.error('Database schema apply failed', {
        schemaId: normalized.id,
        host: normalized.connection.host,
        database: normalized.connection.database,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new InternalServerErrorException('Failed to apply database schema');
    } finally {
      client.release();
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
    const relationships = (schema.relationships ?? []).filter(
      (relationship) => relationship && tableIds.has(relationship.sourceTableId) && tableIds.has(relationship.targetTableId)
    );

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

    for (const table of schema.tables) {
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
    }

    for (const relationship of schema.relationships ?? []) {
      const relationshipStatements = this.buildRelationshipStatements(relationship, tableMap);
      statements.push(...relationshipStatements);
    }

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

  private buildRelationshipStatements(relationship: DatabaseSchema['relationships'][number], tableMap: Map<string, DatabaseTable>): string[] {
    const sourceTable = tableMap.get(relationship.sourceTableId);
    const targetTable = tableMap.get(relationship.targetTableId);
    if (!sourceTable || !targetTable) {
      return [];
    }

    const targetIdField = targetTable.fields.find((field) => field.isId) ?? targetTable.fields[0];
    if (!targetIdField) {
      return [];
    }

    const fkFieldName = this.ensureValidIdentifier(`${targetTable.name}_id`, 'field');
    const fkField: DatabaseField = {
      id: `${relationship.id}_fk`,
      name: fkFieldName,
      type: targetIdField.type,
      nullable: relationship.modality === 0,
      unique: relationship.cardinality === 'one',
      isId: false
    };

    const statements: string[] = [];
    statements.push(this.buildAddColumnStatement(sourceTable.name, fkField));
    if (!fkField.nullable) {
      statements.push(this.buildNotNullStatement(sourceTable.name, fkField.name));
    }
    if (fkField.unique) {
      statements.push(this.buildUniqueIndexStatement(sourceTable.name, fkField.name));
    }

    const constraintName = this.ensureValidIdentifier(`${relationship.id}_fk`, 'constraint');
    const constraintClause = `FOREIGN KEY (${this.quoteIdentifier(fkField.name)}) REFERENCES ${this.quoteIdentifier(targetTable.name)} (${this.quoteIdentifier(targetIdField.name)}) ON DELETE ${relationship.modality === 0 ? 'SET NULL' : 'CASCADE'}`;
    statements.push(this.buildConstraintIfMissing(sourceTable.name, constraintName, constraintClause));

    return statements;
  }

  private buildConstraintIfMissing(tableName: string, constraintName: string, clause: string): string {
    return `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD CONSTRAINT ${this.quoteIdentifier(constraintName)} ${clause};`;
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
    if (code === '42710') {
      return true;
    }
    return message.includes('already exists');
  }
}
