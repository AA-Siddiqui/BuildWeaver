import type {
  QueryTableNodeData,
  QueryWhereNodeData,
  QueryJoinNodeData,
  QueryGroupByNodeData,
  QueryHavingNodeData,
  QueryOrderByNodeData,
  QueryLimitNodeData,
  QueryAggregationNodeData,
  QueryAttributeNodeData,
  QueryArgumentNodeData,
  DatabaseSchema,
  DatabaseField,
  QueryMode,
  LogicEditorNodeData,
  SqlJoinType
} from '@buildweaver/libs';
import type { Node, Edge } from 'reactflow';
import { logicLogger } from '../../../lib/logger';
import type { NodePreview, QueryColumnShape } from '../preview';

const LOG_PREFIX = 'QueryPreview';

// ── Schema helpers ──────────────────────────────────────────────────

const lookupTableFields = (
  schema: DatabaseSchema | null,
  tableName: string
): DatabaseField[] => {
  if (!schema) {
    logicLogger.debug(`[${LOG_PREFIX}] no schema available for field lookup`, { tableName });
    return [];
  }
  const table = schema.tables.find((t) => t.name === tableName);
  if (!table) {
    logicLogger.warn(`[${LOG_PREFIX}] table not found in schema`, { tableName, schemaName: schema.name });
    return [];
  }
  logicLogger.debug(`[${LOG_PREFIX}] resolved ${table.fields.length} field(s) for table`, { tableName });
  return table.fields;
};

const fieldToColumnShape = (field: DatabaseField, table?: string): QueryColumnShape => ({
  name: field.name,
  type: field.type,
  table
});

// ── Formatting helpers ──────────────────────────────────────────────

const formatOperator = (op: string): string => op.toUpperCase();

const formatJoinType = (joinType: SqlJoinType): string => {
  switch (joinType) {
    case 'inner':
      return 'INNER JOIN';
    case 'left':
      return 'LEFT JOIN';
    case 'right':
      return 'RIGHT JOIN';
    case 'full':
      return 'FULL OUTER JOIN';
    default:
      return 'JOIN';
  }
};

// ── Per-node SQL fragment builders ──────────────────────────────────

export const buildTableSqlFragment = (
  data: QueryTableNodeData,
  mode: QueryMode
): string => {
  if (!data.tableName) {
    logicLogger.debug(`[${LOG_PREFIX}] buildTableSqlFragment called with empty table name`);
    return '-- no table selected';
  }

  logicLogger.debug(`[${LOG_PREFIX}] building table SQL fragment`, { tableName: data.tableName, mode });

  switch (mode) {
    case 'read': {
      const cols =
        data.selectedColumns.length > 0
          ? data.selectedColumns.map((c) => `${data.tableName}.${c}`).join(', ')
          : `${data.tableName}.*`;
      return `SELECT ${cols}\nFROM ${data.tableName}`;
    }
    case 'insert': {
      const fields =
        Object.keys(data.columnDefaults).length > 0
          ? Object.keys(data.columnDefaults)
          : data.selectedColumns;
      if (fields.length === 0) {
        return `INSERT INTO ${data.tableName}\n-- columns not configured`;
      }
      const cols = fields.join(', ');
      const vals = fields
        .map((f) => {
          const def = data.columnDefaults[f];
          return def ? `'${def}'` : '?';
        })
        .join(', ');
      return `INSERT INTO ${data.tableName} (${cols})\nVALUES (${vals})`;
    }
    case 'update': {
      if (data.selectedColumns.length === 0) {
        return `UPDATE ${data.tableName}\n-- columns not configured`;
      }
      const sets = data.selectedColumns
        .map((c) => {
          const def = data.columnDefaults[c];
          return `${c} = ${def ? `'${def}'` : '?'}`;
        })
        .join(', ');
      return `UPDATE ${data.tableName}\nSET ${sets}`;
    }
    case 'delete':
      return `DELETE FROM ${data.tableName}`;
    default:
      return `-- unsupported mode`;
  }
};

export const buildWhereSqlFragment = (data: QueryWhereNodeData): string => {
  logicLogger.debug(`[${LOG_PREFIX}] building WHERE SQL fragment`, {
    operator: data.operator,
    leftOperand: data.leftOperand,
    rightOperand: data.rightOperand
  });

  const left = data.leftIsColumn
    ? data.leftOperand || '?'
    : data.leftOperand
      ? `'${data.leftOperand}'`
      : '?';

  const op = formatOperator(data.operator);

  if (data.operator === 'is null' || data.operator === 'is not null') {
    return `WHERE ${left} ${op}`;
  }

  const right = data.rightIsColumn
    ? data.rightOperand || '?'
    : data.rightOperand
      ? `'${data.rightOperand}'`
      : '?';

  return `WHERE ${left} ${op} ${right}`;
};

export const buildJoinSqlFragment = (data: QueryJoinNodeData): string => {
  const joinStr = formatJoinType(data.joinType);
  const tableB = data.tableB || '?';
  const attrA = data.tableA && data.attributeA ? `${data.tableA}.${data.attributeA}` : '?';
  const attrB = data.tableB && data.attributeB ? `${data.tableB}.${data.attributeB}` : '?';

  logicLogger.debug(`[${LOG_PREFIX}] building JOIN SQL fragment`, {
    joinType: data.joinType,
    tableA: data.tableA,
    tableB: data.tableB
  });

  return `${joinStr} ${tableB}\nON ${attrA} = ${attrB}`;
};

export const buildGroupBySqlFragment = (data: QueryGroupByNodeData): string => {
  const attrs = data.attributes.filter(Boolean);
  logicLogger.debug(`[${LOG_PREFIX}] building GROUP BY SQL fragment`, { attributeCount: attrs.length });
  if (attrs.length === 0) {
    return 'GROUP BY ?';
  }
  return `GROUP BY ${attrs.join(', ')}`;
};

export const buildHavingSqlFragment = (data: QueryHavingNodeData): string => {
  logicLogger.debug(`[${LOG_PREFIX}] building HAVING SQL fragment`, {
    operator: data.operator,
    leftOperand: data.leftOperand
  });

  const left = data.leftIsColumn
    ? data.leftOperand || '?'
    : data.leftOperand
      ? `'${data.leftOperand}'`
      : '?';

  const op = formatOperator(data.operator);

  if (data.operator === 'is null' || data.operator === 'is not null') {
    return `HAVING ${left} ${op}`;
  }

  const right = data.rightIsColumn
    ? data.rightOperand || '?'
    : data.rightOperand
      ? `'${data.rightOperand}'`
      : '?';

  return `HAVING ${left} ${op} ${right}`;
};

export const buildOrderBySqlFragment = (data: QueryOrderByNodeData): string => {
  const parts: string[] = [];
  for (let i = 0; i < data.sortCount; i++) {
    const attr = data.sortAttributes[i] || '?';
    const order = (data.sortOrders[i] || 'asc').toUpperCase();
    parts.push(`${attr} ${order}`);
  }
  logicLogger.debug(`[${LOG_PREFIX}] building ORDER BY SQL fragment`, { sortCount: data.sortCount });
  return `ORDER BY ${parts.join(', ')}`;
};

export const buildLimitSqlFragment = (data: QueryLimitNodeData): string => {
  const parts: string[] = [];
  if (data.limitValue !== undefined) {
    parts.push(`LIMIT ${data.limitValue}`);
  }
  if (data.offsetValue !== undefined) {
    parts.push(`OFFSET ${data.offsetValue}`);
  }
  logicLogger.debug(`[${LOG_PREFIX}] building LIMIT SQL fragment`, {
    limit: data.limitValue,
    offset: data.offsetValue
  });
  return parts.length > 0 ? parts.join(' ') : 'LIMIT ?';
};

export const buildAggregationSqlFragment = (data: QueryAggregationNodeData): string => {
  const fn = data.function.toUpperCase();
  const attr = data.attribute
    ? data.tableName
      ? `${data.tableName}.${data.attribute}`
      : data.attribute
    : '*';
  logicLogger.debug(`[${LOG_PREFIX}] building aggregation SQL fragment`, { function: data.function, attribute: attr });
  return `${fn}(${attr})`;
};

export const buildAttributeSqlFragment = (data: QueryAttributeNodeData): string => {
  if (!data.tableName && !data.attributeName) {
    return '?';
  }
  if (data.tableName && data.attributeName) {
    return `${data.tableName}.${data.attributeName}`;
  }
  return data.attributeName || '?';
};

export const buildArgumentSqlFragment = (data: QueryArgumentNodeData): string => {
  return `:${data.name || 'param'}`;
};

// ── Per-node data shape inference ───────────────────────────────────

export const inferTableDataShape = (
  data: QueryTableNodeData,
  schema: DatabaseSchema | null,
  mode: QueryMode
): QueryColumnShape[] => {
  logicLogger.debug(`[${LOG_PREFIX}] inferring table data shape`, {
    tableName: data.tableName,
    mode,
    selectedColumns: data.selectedColumns.length
  });

  const fields = lookupTableFields(schema, data.tableName);

  if (mode === 'delete') {
    return [{ name: 'affected_rows', type: 'number' }];
  }

  if (mode === 'read') {
    if (data.selectedColumns.length > 0) {
      return data.selectedColumns.map((colName) => {
        const field = fields.find((f) => f.name === colName);
        return { name: colName, type: field?.type ?? 'unknown', table: data.tableName };
      });
    }
    return fields.map((f) => fieldToColumnShape(f, data.tableName));
  }

  // Insert / update: return columns being set
  const cols =
    data.selectedColumns.length > 0 ? data.selectedColumns : Object.keys(data.columnDefaults);
  return cols.map((colName) => {
    const field = fields.find((f) => f.name === colName);
    return { name: colName, type: field?.type ?? 'unknown', table: data.tableName };
  });
};

export const inferJoinDataShape = (
  data: QueryJoinNodeData,
  schema: DatabaseSchema | null
): QueryColumnShape[] => {
  logicLogger.debug(`[${LOG_PREFIX}] inferring join data shape`, {
    tableA: data.tableA,
    tableB: data.tableB
  });

  const fieldsA = lookupTableFields(schema, data.tableA ?? '');
  const fieldsB = lookupTableFields(schema, data.tableB ?? '');
  return [
    ...fieldsA.map((f) => fieldToColumnShape(f, data.tableA)),
    ...fieldsB.map((f) => fieldToColumnShape(f, data.tableB))
  ];
};

export const inferAggregationDataShape = (data: QueryAggregationNodeData): QueryColumnShape[] => {
  const fn = data.function.toUpperCase();
  const attr = data.attribute ?? '*';
  return [{ name: `${fn}(${attr})`, type: 'number' }];
};

export const inferAttributeDataShape = (
  data: QueryAttributeNodeData,
  schema: DatabaseSchema | null
): QueryColumnShape[] => {
  if (!data.tableName || !data.attributeName) {
    return [];
  }
  const fields = lookupTableFields(schema, data.tableName);
  const field = fields.find((f) => f.name === data.attributeName);
  return [{ name: data.attributeName, type: field?.type ?? 'unknown', table: data.tableName }];
};

// ── Full SQL assembly (for output node) ─────────────────────────────

interface CollectedQueryNodes {
  tables: Node<QueryTableNodeData>[];
  joins: Node<QueryJoinNodeData>[];
  wheres: Node<QueryWhereNodeData>[];
  groupBys: Node<QueryGroupByNodeData>[];
  havings: Node<QueryHavingNodeData>[];
  orderBys: Node<QueryOrderByNodeData>[];
  limits: Node<QueryLimitNodeData>[];
  aggregations: Node<QueryAggregationNodeData>[];
}

export const collectUpstreamNodes = (
  startNodeId: string,
  nodes: Node<LogicEditorNodeData>[],
  edges: Edge[]
): CollectedQueryNodes => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const collected: CollectedQueryNodes = {
    tables: [],
    joins: [],
    wheres: [],
    groupBys: [],
    havings: [],
    orderBys: [],
    limits: [],
    aggregations: []
  };

  const walk = (nodeId: string) => {
    if (visited.has(nodeId)) {
      logicLogger.debug(`[${LOG_PREFIX}] skipping already-visited node during upstream walk`, { nodeId });
      return;
    }
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) {
      logicLogger.warn(`[${LOG_PREFIX}] node not found during upstream walk`, { nodeId });
      return;
    }

    switch (node.type) {
      case 'query-table':
        collected.tables.push(node as Node<QueryTableNodeData>);
        break;
      case 'query-join':
        collected.joins.push(node as Node<QueryJoinNodeData>);
        break;
      case 'query-where':
        collected.wheres.push(node as Node<QueryWhereNodeData>);
        break;
      case 'query-groupby':
        collected.groupBys.push(node as Node<QueryGroupByNodeData>);
        break;
      case 'query-having':
        collected.havings.push(node as Node<QueryHavingNodeData>);
        break;
      case 'query-orderby':
        collected.orderBys.push(node as Node<QueryOrderByNodeData>);
        break;
      case 'query-limit':
        collected.limits.push(node as Node<QueryLimitNodeData>);
        break;
      case 'query-aggregation':
        collected.aggregations.push(node as Node<QueryAggregationNodeData>);
        break;
    }

    const incomingEdges = edges.filter((e) => e.target === nodeId);
    logicLogger.debug(`[${LOG_PREFIX}] walking upstream`, {
      nodeId,
      nodeType: node.type,
      incomingEdgeCount: incomingEdges.length
    });
    for (const edge of incomingEdges) {
      walk(edge.source);
    }
  };

  walk(startNodeId);

  logicLogger.info(`[${LOG_PREFIX}] upstream walk complete`, {
    startNodeId,
    tables: collected.tables.length,
    joins: collected.joins.length,
    wheres: collected.wheres.length,
    groupBys: collected.groupBys.length,
    havings: collected.havings.length,
    orderBys: collected.orderBys.length,
    limits: collected.limits.length,
    aggregations: collected.aggregations.length
  });

  return collected;
};

export const assembleFullSql = (
  outputNodeId: string,
  nodes: Node<LogicEditorNodeData>[],
  edges: Edge[],
  mode: QueryMode
): string => {
  logicLogger.debug(`[${LOG_PREFIX}] assembling full SQL`, {
    outputNodeId,
    mode,
    nodeCount: nodes.length,
    edgeCount: edges.length
  });

  const collected = collectUpstreamNodes(outputNodeId, nodes, edges);

  if (collected.tables.length === 0) {
    logicLogger.info(`[${LOG_PREFIX}] no table nodes connected to output`, { outputNodeId });
    return '-- No tables connected';
  }

  const primaryTable = collected.tables[0].data;

  switch (mode) {
    case 'read': {
      const selectParts: string[] = [];

      for (const agg of collected.aggregations) {
        selectParts.push(buildAggregationSqlFragment(agg.data));
      }

      for (const table of collected.tables) {
        if (table.data.selectedColumns.length > 0) {
          selectParts.push(
            ...table.data.selectedColumns.map((c) => `${table.data.tableName}.${c}`)
          );
        } else if (selectParts.length === 0) {
          selectParts.push(`${table.data.tableName}.*`);
        }
      }

      if (selectParts.length === 0) {
        selectParts.push('*');
      }

      const parts: string[] = [`SELECT ${selectParts.join(', ')}`];
      parts.push(`FROM ${primaryTable.tableName}`);

      for (const join of collected.joins) {
        parts.push(buildJoinSqlFragment(join.data));
      }

      for (const where of collected.wheres) {
        parts.push(buildWhereSqlFragment(where.data));
      }

      for (const groupBy of collected.groupBys) {
        parts.push(buildGroupBySqlFragment(groupBy.data));
      }

      for (const having of collected.havings) {
        parts.push(buildHavingSqlFragment(having.data));
      }

      for (const orderBy of collected.orderBys) {
        parts.push(buildOrderBySqlFragment(orderBy.data));
      }

      for (const limit of collected.limits) {
        parts.push(buildLimitSqlFragment(limit.data));
      }

      const sql = parts.join('\n');
      logicLogger.info(`[${LOG_PREFIX}] full read SQL assembled`, {
        outputNodeId,
        clauseCount: parts.length
      });
      return sql;
    }

    case 'insert': {
      const fields =
        Object.keys(primaryTable.columnDefaults).length > 0
          ? Object.keys(primaryTable.columnDefaults)
          : primaryTable.selectedColumns;

      if (fields.length === 0) {
        logicLogger.info(`[${LOG_PREFIX}] insert SQL has no columns configured`, { outputNodeId });
        return `INSERT INTO ${primaryTable.tableName}\n-- configure columns`;
      }

      const cols = fields.join(', ');
      const vals = fields
        .map((f) => {
          const def = primaryTable.columnDefaults[f];
          return def ? `'${def}'` : '?';
        })
        .join(', ');

      const sql = `INSERT INTO ${primaryTable.tableName} (${cols})\nVALUES (${vals})`;
      logicLogger.info(`[${LOG_PREFIX}] full insert SQL assembled`, { outputNodeId });
      return sql;
    }

    case 'update': {
      const parts: string[] = [`UPDATE ${primaryTable.tableName}`];

      if (primaryTable.selectedColumns.length > 0) {
        const sets = primaryTable.selectedColumns
          .map((c) => {
            const def = primaryTable.columnDefaults[c];
            return `${c} = ${def ? `'${def}'` : '?'}`;
          })
          .join(', ');
        parts.push(`SET ${sets}`);
      } else {
        parts.push('SET -- configure columns');
      }

      for (const where of collected.wheres) {
        parts.push(buildWhereSqlFragment(where.data));
      }

      const sql = parts.join('\n');
      logicLogger.info(`[${LOG_PREFIX}] full update SQL assembled`, { outputNodeId });
      return sql;
    }

    case 'delete': {
      const parts: string[] = [`DELETE FROM ${primaryTable.tableName}`];

      for (const where of collected.wheres) {
        parts.push(buildWhereSqlFragment(where.data));
      }

      const sql = parts.join('\n');
      logicLogger.info(`[${LOG_PREFIX}] full delete SQL assembled`, { outputNodeId });
      return sql;
    }

    default:
      logicLogger.warn(`[${LOG_PREFIX}] unsupported query mode for full SQL`, { mode });
      return '-- unsupported mode';
  }
};

export const inferFullDataShape = (
  outputNodeId: string,
  nodes: Node<LogicEditorNodeData>[],
  edges: Edge[],
  schema: DatabaseSchema | null,
  mode: QueryMode
): QueryColumnShape[] => {
  logicLogger.debug(`[${LOG_PREFIX}] inferring full data shape`, { outputNodeId, mode });

  const collected = collectUpstreamNodes(outputNodeId, nodes, edges);

  if (mode === 'delete') {
    logicLogger.debug(`[${LOG_PREFIX}] delete mode yields affected_rows shape`);
    return [{ name: 'affected_rows', type: 'number' }];
  }

  const allColumns: QueryColumnShape[] = [];

  for (const table of collected.tables) {
    const shapes = inferTableDataShape(table.data, schema, mode);
    allColumns.push(...shapes);
  }

  for (const agg of collected.aggregations) {
    allColumns.push(...inferAggregationDataShape(agg.data));
  }

  logicLogger.debug(`[${LOG_PREFIX}] full data shape inferred`, {
    outputNodeId,
    columnCount: allColumns.length
  });

  return allColumns;
};

// ── Entry-point evaluator ───────────────────────────────────────────

export interface QueryPreviewContext {
  schema: DatabaseSchema | null;
  mode: QueryMode;
  allNodes: Node<LogicEditorNodeData>[];
  allEdges: Edge[];
}

export const evaluateQueryNodePreview = (
  node: Node<LogicEditorNodeData>,
  context: QueryPreviewContext
): NodePreview => {
  const { schema, mode, allNodes, allEdges } = context;

  logicLogger.debug(`[${LOG_PREFIX}] evaluating preview`, {
    nodeId: node.id,
    nodeType: node.type,
    mode
  });

  switch (node.type) {
    case 'query-table': {
      const data = node.data as QueryTableNodeData;
      if (!data.tableName) {
        logicLogger.info(`[${LOG_PREFIX}] table node has no table selected`, { nodeId: node.id });
        return {
          state: 'unknown',
          heading: 'No table selected',
          summary: 'Select a table to preview.'
        };
      }
      const sql = buildTableSqlFragment(data, mode);
      const dataShape = inferTableDataShape(data, schema, mode);
      logicLogger.info(`[${LOG_PREFIX}] table node preview ready`, {
        nodeId: node.id,
        tableName: data.tableName,
        columnCount: dataShape.length
      });
      return {
        state: 'ready',
        heading: data.tableName,
        summary: `${dataShape.length} column(s)`,
        value: sql,
        dataShape,
        sql
      };
    }

    case 'query-where': {
      const data = node.data as QueryWhereNodeData;
      const sql = buildWhereSqlFragment(data);
      logicLogger.debug(`[${LOG_PREFIX}] where node preview ready`, { nodeId: node.id });
      return {
        state: 'ready',
        heading: 'WHERE filter',
        summary: sql,
        value: sql,
        sql,
        dataShape: []
      };
    }

    case 'query-join': {
      const data = node.data as QueryJoinNodeData;
      const sql = buildJoinSqlFragment(data);
      const dataShape = inferJoinDataShape(data, schema);
      logicLogger.info(`[${LOG_PREFIX}] join node preview ready`, {
        nodeId: node.id,
        joinType: data.joinType,
        columnCount: dataShape.length
      });
      return {
        state: 'ready',
        heading: formatJoinType(data.joinType),
        summary: `${data.tableA || '?'} \u2194 ${data.tableB || '?'}`,
        value: sql,
        sql,
        dataShape
      };
    }

    case 'query-groupby': {
      const data = node.data as QueryGroupByNodeData;
      const sql = buildGroupBySqlFragment(data);
      const attrs = data.attributes.filter(Boolean);
      logicLogger.debug(`[${LOG_PREFIX}] group-by node preview ready`, {
        nodeId: node.id,
        attributeCount: attrs.length
      });
      return {
        state: 'ready',
        heading: 'GROUP BY',
        summary: attrs.join(', ') || 'No attributes',
        value: sql,
        sql,
        dataShape: []
      };
    }

    case 'query-having': {
      const data = node.data as QueryHavingNodeData;
      const sql = buildHavingSqlFragment(data);
      logicLogger.debug(`[${LOG_PREFIX}] having node preview ready`, { nodeId: node.id });
      return {
        state: 'ready',
        heading: 'HAVING filter',
        summary: sql,
        value: sql,
        sql,
        dataShape: []
      };
    }

    case 'query-orderby': {
      const data = node.data as QueryOrderByNodeData;
      const sql = buildOrderBySqlFragment(data);
      logicLogger.debug(`[${LOG_PREFIX}] order-by node preview ready`, { nodeId: node.id });
      return {
        state: 'ready',
        heading: 'ORDER BY',
        summary: sql.replace('ORDER BY ', ''),
        value: sql,
        sql,
        dataShape: []
      };
    }

    case 'query-limit': {
      const data = node.data as QueryLimitNodeData;
      const sql = buildLimitSqlFragment(data);
      logicLogger.debug(`[${LOG_PREFIX}] limit node preview ready`, { nodeId: node.id });
      return {
        state: 'ready',
        heading: 'LIMIT',
        summary: sql,
        value: sql,
        sql,
        dataShape: []
      };
    }

    case 'query-aggregation': {
      const data = node.data as QueryAggregationNodeData;
      const sql = buildAggregationSqlFragment(data);
      const dataShape = inferAggregationDataShape(data);
      logicLogger.debug(`[${LOG_PREFIX}] aggregation node preview ready`, {
        nodeId: node.id,
        function: data.function
      });
      return {
        state: 'ready',
        heading: 'Aggregation',
        summary: sql,
        value: sql,
        sql,
        dataShape
      };
    }

    case 'query-attribute': {
      const data = node.data as QueryAttributeNodeData;
      const sql = buildAttributeSqlFragment(data);
      const dataShape = inferAttributeDataShape(data, schema);
      const isReady = Boolean(data.tableName && data.attributeName);
      logicLogger.debug(`[${LOG_PREFIX}] attribute node preview`, {
        nodeId: node.id,
        isReady,
        tableName: data.tableName,
        attributeName: data.attributeName
      });
      return {
        state: isReady ? 'ready' : 'unknown',
        heading: 'Attribute',
        summary: sql === '?' ? 'Select table and attribute' : sql,
        value: isReady ? sql : undefined,
        sql,
        dataShape
      };
    }

    case 'query-argument': {
      const data = node.data as QueryArgumentNodeData;
      const sql = buildArgumentSqlFragment(data);
      logicLogger.debug(`[${LOG_PREFIX}] argument node preview ready`, {
        nodeId: node.id,
        name: data.name,
        type: data.type
      });
      return {
        state: 'ready',
        heading: data.name || 'Argument',
        summary: `Type: ${data.type}`,
        value: sql,
        sql,
        dataShape: [{ name: data.name, type: data.type }]
      };
    }

    case 'query-output': {
      const sql = assembleFullSql(node.id, allNodes, allEdges, mode);
      const dataShape = inferFullDataShape(node.id, allNodes, allEdges, schema, mode);
      logicLogger.info(`[${LOG_PREFIX}] output node preview computed`, {
        nodeId: node.id,
        mode,
        columnCount: dataShape.length,
        sqlLength: sql.length
      });
      return {
        state: dataShape.length > 0 ? 'ready' : 'unknown',
        heading: 'Query Result',
        summary:
          dataShape.length > 0
            ? `${dataShape.length} column(s)`
            : 'Connect table nodes to see preview.',
        value: dataShape.length > 0 ? sql : undefined,
        sql,
        dataShape
      };
    }

    default:
      logicLogger.warn(`[${LOG_PREFIX}] unrecognised query node type`, {
        nodeId: node.id,
        nodeType: node.type
      });
      return {
        state: 'unknown',
        heading: 'Unknown',
        summary: 'Query node type not recognised.'
      };
  }
};
