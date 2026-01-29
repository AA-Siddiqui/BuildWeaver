import { HttpException, HttpStatus } from '@nestjs/common';

export interface DatabaseSchemaErrorDetails {
  schemaId?: string;
  statement?: string;
  tableName?: string;
  fieldName?: string;
  constraintName?: string;
  relationshipId?: string;
  pgCode?: string;
  pgDetail?: string;
  pgHint?: string;
  originalMessage?: string;
}

export class DatabaseSchemaException extends HttpException {
  public readonly details: DatabaseSchemaErrorDetails;

  constructor(message: string, details: DatabaseSchemaErrorDetails = {}, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
    const response = {
      message,
      error: 'Database Schema Error',
      statusCode: status,
      details: DatabaseSchemaException.sanitizeDetails(details)
    };
    super(response, status);
    this.details = details;
  }

  private static sanitizeDetails(details: DatabaseSchemaErrorDetails): DatabaseSchemaErrorDetails {
    // Remove undefined values for cleaner response
    const sanitized: DatabaseSchemaErrorDetails = {};
    for (const [key, value] of Object.entries(details)) {
      if (value !== undefined && value !== null && value !== '') {
        sanitized[key as keyof DatabaseSchemaErrorDetails] = value;
      }
    }
    return sanitized;
  }

  static fromPgError(error: unknown, context: Partial<DatabaseSchemaErrorDetails>): DatabaseSchemaException {
    // Handle null/undefined error
    if (!error) {
      return new DatabaseSchemaException('Database error [UNKNOWN]: Unknown database error', {
        ...context,
        pgCode: undefined
      });
    }

    const pgError = error as {
      code?: string;
      detail?: string;
      hint?: string;
      message?: string;
      constraint?: string;
      table?: string;
      column?: string;
    };

    const errorCode = pgError.code ?? 'UNKNOWN';
    const humanMessage = DatabaseSchemaException.translatePgCode(errorCode, pgError.message);

    return new DatabaseSchemaException(humanMessage, {
      ...context,
      pgCode: pgError.code,
      pgDetail: pgError.detail,
      pgHint: pgError.hint,
      originalMessage: pgError.message,
      constraintName: pgError.constraint ?? context.constraintName,
      tableName: pgError.table ?? context.tableName,
      fieldName: pgError.column ?? context.fieldName
    });
  }

  private static translatePgCode(code: string, originalMessage?: string): string {
    const translations: Record<string, string> = {
      // Class 08 - Connection Exception
      '08000': 'Database connection failed',
      '08003': 'Connection does not exist',
      '08006': 'Connection failure during transaction',

      // Class 22 - Data Exception
      '22001': 'String value too long for column',
      '22003': 'Numeric value out of range',
      '22007': 'Invalid datetime format',
      '22008': 'Datetime field overflow',
      '22012': 'Division by zero',
      '22P02': 'Invalid text representation for type',

      // Class 23 - Integrity Constraint Violation
      '23000': 'Integrity constraint violation',
      '23001': 'Restrict violation - referenced data exists',
      '23502': 'NOT NULL constraint violation - required field is missing',
      '23503': 'Foreign key constraint violation - referenced row not found',
      '23505': 'Unique constraint violation - duplicate value exists',
      '23514': 'Check constraint violation',

      // Class 25 - Invalid Transaction State
      '25001': 'Active SQL transaction - cannot perform operation',
      '25006': 'Read-only transaction - cannot perform write operation',
      '25P02': 'Transaction aborted - a previous statement failed, please retry the operation',

      // Class 28 - Invalid Authorization Specification
      '28000': 'Invalid database authorization - check credentials',
      '28P01': 'Password authentication failed - check credentials',

      // Class 3D - Invalid Catalog Name
      '3D000': 'Database does not exist',

      // Class 3F - Invalid Schema Name
      '3F000': 'Schema does not exist',

      // Class 42 - Syntax Error or Access Rule Violation
      '42000': 'Syntax error or access violation',
      '42501': 'Insufficient privilege - permission denied',
      '42601': 'SQL syntax error',
      '42602': 'Invalid name - identifier contains invalid characters',
      '42622': 'Name too long - identifier exceeds length limit',
      '42701': 'Duplicate column name in table',
      '42702': 'Ambiguous column reference',
      '42703': 'Column does not exist',
      '42704': 'Type does not exist',
      '42710': 'Object already exists',
      '42712': 'Duplicate alias in query',
      '42723': 'Function already exists',
      '42725': 'Ambiguous function call',
      '42803': 'Grouping error in query',
      '42804': 'Datatype mismatch',
      '42830': 'Invalid foreign key - column type mismatch',
      '42846': 'Cannot coerce - type conversion not possible',
      '42883': 'Function does not exist',
      '42939': 'Reserved name - cannot use this identifier',
      '42P01': 'Table does not exist',
      '42P02': 'Parameter does not exist',
      '42P03': 'Duplicate cursor name',
      '42P04': 'Duplicate database name',
      '42P05': 'Duplicate prepared statement',
      '42P06': 'Duplicate schema name',
      '42P07': 'Table already exists',
      '42P08': 'Ambiguous parameter',
      '42P09': 'Ambiguous alias',
      '42P10': 'Invalid column reference',
      '42P11': 'Invalid cursor definition',
      '42P12': 'Invalid database definition',
      '42P13': 'Invalid function definition',
      '42P14': 'Invalid prepared statement definition',
      '42P15': 'Invalid schema definition',
      '42P16': 'Invalid table definition',
      '42P17': 'Invalid object definition',
      '42P18': 'Indeterminate datatype',
      '42P19': 'Invalid recursion',
      '42P20': 'Windowing error',
      '42P21': 'Collation mismatch',

      // Class 53 - Insufficient Resources
      '53000': 'Insufficient resources on database server',
      '53100': 'Disk full on database server',
      '53200': 'Out of memory on database server',
      '53300': 'Too many connections to database',

      // Class 55 - Object Not In Prerequisite State
      '55006': 'Object in use - cannot perform operation',
      '55P03': 'Lock not available - table is locked',

      // Class 57 - Operator Intervention
      '57014': 'Query cancelled by user or timeout',
      '57P01': 'Database server shutting down',
      '57P02': 'Database crash recovery in progress',
      '57P03': 'Database server not accepting connections'
    };

    const translated = translations[code];
    if (translated) {
      return translated;
    }

    // Fall back to original message with code prefix
    const baseMessage = originalMessage ?? 'Unknown database error';
    return `Database error [${code}]: ${baseMessage}`;
  }
}
