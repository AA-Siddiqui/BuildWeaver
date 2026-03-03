import type {
  QueryDefinition,
  QueryTableNodeData,
  QueryWhereNodeData,
  QueryOrderByNodeData,
  QueryLimitNodeData,
  QueryJoinNodeData,
} from '@buildweaver/libs';
import type { GeneratedFile } from '../../core/bundle';

const LOG_PREFIX = '[Codegen:Express:Query]';

/* ── Naming helpers ───────────────────────────────────────────────── */

export const toFunctionName = (name: string): string => {
  const pascal = name
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join('');
  return `execute${pascal || 'Query'}`;
};

/* ── Node extraction helpers ──────────────────────────────────────── */

const extractTableNodes = (query: QueryDefinition): QueryTableNodeData[] =>
  query.nodes
    .filter((n) => n.type === 'query-table')
    .map((n) => n.data as QueryTableNodeData);

const extractWhereNodes = (query: QueryDefinition): QueryWhereNodeData[] =>
  query.nodes
    .filter((n) => n.type === 'query-where')
    .map((n) => n.data as QueryWhereNodeData);

const extractOrderByNodes = (query: QueryDefinition): QueryOrderByNodeData[] =>
  query.nodes
    .filter((n) => n.type === 'query-orderby')
    .map((n) => n.data as QueryOrderByNodeData);

const extractLimitNodes = (query: QueryDefinition): QueryLimitNodeData[] =>
  query.nodes
    .filter((n) => n.type === 'query-limit')
    .map((n) => n.data as QueryLimitNodeData);

const extractJoinNodes = (query: QueryDefinition): QueryJoinNodeData[] =>
  query.nodes
    .filter((n) => n.type === 'query-join')
    .map((n) => n.data as QueryJoinNodeData);

/* ── SQL builders per mode ────────────────────────────────────────── */

const buildSelectSQL = (
  query: QueryDefinition,
): { sql: string; argNames: string[] } => {
  const tables = extractTableNodes(query);
  const wheres = extractWhereNodes(query);
  const orderBys = extractOrderByNodes(query);
  const limits = extractLimitNodes(query);
  const joins = extractJoinNodes(query);

  if (tables.length === 0) {
    return {
      sql: `/* No table defined for query "${query.name}" */\nSELECT 1`,
      argNames: [],
    };
  }

  const mainTable = tables[0];
  const columns =
    mainTable.selectedColumns.length > 0
      ? mainTable.selectedColumns
          .map((c) => `"${mainTable.tableName}"."${c}"`)
          .join(', ')
      : `"${mainTable.tableName}".*`;

  let sql = `SELECT ${columns}\n  FROM "${mainTable.tableName}"`;
  const argNames: string[] = [];
  let paramIdx = 0;

  for (const join of joins) {
    if (join.tableA && join.tableB && join.attributeA && join.attributeB) {
      sql += `\n  ${join.joinType.toUpperCase()} JOIN "${join.tableB}" ON "${join.tableA}"."${join.attributeA}" = "${join.tableB}"."${join.attributeB}"`;
    }
  }

  const validWheres = wheres.filter((w) => w.leftOperand);
  if (validWheres.length > 0) {
    const conds = validWheres.map((w) => {
      if (w.operator === 'is null' || w.operator === 'is not null') {
        return `"${w.leftOperand}" ${w.operator.toUpperCase()}`;
      }
      paramIdx++;
      if (!w.rightIsColumn && w.rightOperand) {
        argNames.push(w.rightOperand);
      }
      return `"${w.leftOperand}" ${w.operator} $${paramIdx}`;
    });
    sql += `\n  WHERE ${conds.join('\n    AND ')}`;
  }

  if (orderBys.length > 0 && orderBys[0].sortAttributes.length > 0) {
    const sorts = orderBys[0].sortAttributes.map(
      (attr, i) =>
        `"${attr}" ${(orderBys[0].sortOrders[i] ?? 'asc').toUpperCase()}`,
    );
    sql += `\n  ORDER BY ${sorts.join(', ')}`;
  }

  if (limits.length > 0) {
    if (limits[0].limitValue !== undefined) sql += `\n  LIMIT ${limits[0].limitValue}`;
    if (limits[0].offsetValue !== undefined) sql += `\n  OFFSET ${limits[0].offsetValue}`;
  }

  return { sql, argNames };
};

const buildInsertSQL = (
  query: QueryDefinition,
): { sql: string; argNames: string[] } => {
  const tables = extractTableNodes(query);
  if (tables.length === 0) {
    return {
      sql: `/* No table defined for insert query "${query.name}" */`,
      argNames: [],
    };
  }

  const mainTable = tables[0];
  const cols =
    mainTable.selectedColumns.length > 0
      ? mainTable.selectedColumns
      : query.arguments.map((a) => a.name);

  if (cols.length === 0) {
    return {
      sql: `INSERT INTO "${mainTable.tableName}" DEFAULT VALUES RETURNING *`,
      argNames: [],
    };
  }

  const colList = cols.map((c) => `"${c}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

  return {
    sql: `INSERT INTO "${mainTable.tableName}" (${colList})\n  VALUES (${placeholders})\n  RETURNING *`,
    argNames: cols,
  };
};

const buildUpdateSQL = (
  query: QueryDefinition,
): { sql: string; argNames: string[] } => {
  const tables = extractTableNodes(query);
  const wheres = extractWhereNodes(query);

  if (tables.length === 0) {
    return {
      sql: `/* No table defined for update query "${query.name}" */`,
      argNames: [],
    };
  }

  const mainTable = tables[0];
  const cols =
    mainTable.selectedColumns.length > 0
      ? mainTable.selectedColumns
      : query.arguments.filter((a) => a.name !== 'id').map((a) => a.name);

  const argNames = [...cols];
  let paramIdx = 0;

  const sets = cols.map((col) => {
    paramIdx++;
    return `"${col}" = $${paramIdx}`;
  });

  let sql = `UPDATE "${mainTable.tableName}"\n  SET ${sets.join(', ')}`;

  const validWheres = wheres.filter((w) => w.leftOperand);
  if (validWheres.length > 0) {
    const conds = validWheres.map((w) => {
      paramIdx++;
      if (!w.rightIsColumn && w.rightOperand) argNames.push(w.rightOperand);
      return `"${w.leftOperand}" ${w.operator} $${paramIdx}`;
    });
    sql += `\n  WHERE ${conds.join(' AND ')}`;
  } else {
    paramIdx++;
    argNames.push('id');
    sql += `\n  WHERE "id" = $${paramIdx}`;
  }

  sql += '\n  RETURNING *';
  return { sql, argNames };
};

const buildDeleteSQL = (
  query: QueryDefinition,
): { sql: string; argNames: string[] } => {
  const tables = extractTableNodes(query);
  const wheres = extractWhereNodes(query);

  if (tables.length === 0) {
    return {
      sql: `/* No table defined for delete query "${query.name}" */`,
      argNames: [],
    };
  }

  const mainTable = tables[0];
  let sql = `DELETE FROM "${mainTable.tableName}"`;
  const argNames: string[] = [];
  let paramIdx = 0;

  const validWheres = wheres.filter((w) => w.leftOperand);
  if (validWheres.length > 0) {
    const conds = validWheres.map((w) => {
      paramIdx++;
      if (!w.rightIsColumn && w.rightOperand) argNames.push(w.rightOperand);
      return `"${w.leftOperand}" ${w.operator} $${paramIdx}`;
    });
    sql += `\n  WHERE ${conds.join(' AND ')}`;
  } else {
    paramIdx++;
    argNames.push('id');
    sql += `\n  WHERE "id" = $${paramIdx}`;
  }

  sql += '\n  RETURNING *';
  return { sql, argNames };
};

/* ── Public API ───────────────────────────────────────────────────── */

export const buildQuerySQL = (
  query: QueryDefinition,
): { sql: string; argNames: string[] } => {
  switch (query.mode) {
    case 'read':
      return buildSelectSQL(query);
    case 'insert':
      return buildInsertSQL(query);
    case 'update':
      return buildUpdateSQL(query);
    case 'delete':
      return buildDeleteSQL(query);
    default:
      return { sql: `/* Unknown query mode */`, argNames: [] };
  }
};

export const httpMethodForMode = (mode: string): string => {
  switch (mode) {
    case 'read':
      return 'get';
    case 'insert':
      return 'post';
    case 'update':
      return 'put';
    case 'delete':
      return 'delete';
    default:
      return 'get';
  }
};

export const emitQueryFunction = (query: QueryDefinition): string => {
  const fnName = toFunctionName(query.name);
  const { sql, argNames } = buildQuerySQL(query);

  const argType =
    argNames.length > 0
      ? `{ ${argNames.map((n) => `${n}: unknown`).join('; ')} }`
      : 'Record<string, never>';

  const argArray =
    argNames.length > 0
      ? `[${argNames.map((n) => `args.${n}`).join(', ')}]`
      : '[]';

  return `/**
 * Query: ${query.name} (${query.mode})
 * Schema: ${query.schemaId}
 */
export const ${fnName} = async (
  pool: Pool,
  args: ${argType},
): Promise<QueryResult> => {
  const sql = \`${sql}\`;
  console.info('[Query:${query.name}] Executing ${query.mode} query');
  console.info('[Query:${query.name}] SQL:', sql);
  const result = await pool.query(sql, ${argArray});
  console.info(\`[Query:${query.name}] Returned \${result.rowCount ?? 0} row(s)\`);
  return result;
};`;
};

export const createQueriesFile = (
  queries: QueryDefinition[],
): string => {
  console.info(`${LOG_PREFIX} Emitting ${queries.length} query function(s)`);

  if (queries.length === 0) {
    return `// No queries defined. Add queries in the Logic Editor to generate database query functions.

console.info('[Queries] No query functions generated');
`;
  }

  const imports = `import type { Pool, QueryResult } from 'pg';\n`;
  const functions = queries.map((q) => emitQueryFunction(q)).join('\n\n');
  return `${imports}\n${functions}\n`;
};

export const createQueryFiles = (
  queries: QueryDefinition[],
): GeneratedFile[] => {
  console.info(`${LOG_PREFIX} Creating query files (${queries.length} query/queries)`);
  return [
    { path: 'src/queries/index.ts', contents: createQueriesFile(queries) },
  ];
};
