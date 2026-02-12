import type {
  QueryTableNodeData,
  QueryWhereNodeData,
  QueryJoinNodeData,
  QueryGroupByNodeData,
  QueryOrderByNodeData,
  QueryLimitNodeData,
  QueryAttributeNodeData,
  QueryMode,
  LogicEditorNodeData,
  DatabaseSchema
} from '@buildweaver/libs';
import type { Node, Edge } from 'reactflow';
import { logicLogger } from '../../../lib/logger';
import { collectUpstreamNodes } from './queryPreview';

const LOG_PREFIX = 'QueryValidation';

// ── Types ────────────────────────────────────────────────────────────

export type QueryValidationSeverity = 'error' | 'warning';

export interface QueryValidationDiagnostic {
  /** Unique rule code for programmatic identification. */
  code: string;
  severity: QueryValidationSeverity;
  message: string;
  /** The node that caused the issue, if applicable. */
  nodeId?: string;
}

export interface QueryValidationContext {
  nodes: Node<LogicEditorNodeData>[];
  edges: Edge[];
  mode: QueryMode;
  schema: DatabaseSchema | null;
}

// ── Individual rule checkers ─────────────────────────────────────────

/**
 * Rule: When aggregation nodes are present alongside non-aggregated
 * SELECT columns, a GROUP BY node must be connected that groups
 * by every non-aggregated column.
 */
export const checkMissingGroupBy = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  if (ctx.mode !== 'read') {
    logicLogger.debug(`[${LOG_PREFIX}] checkMissingGroupBy skipped — mode is '${ctx.mode}'`);
    return [];
  }

  const outputNode = ctx.nodes.find((n) => n.type === 'query-output');
  if (!outputNode) {
    logicLogger.debug(`[${LOG_PREFIX}] checkMissingGroupBy skipped — no output node`);
    return [];
  }

  const collected = collectUpstreamNodes(outputNode.id, ctx.nodes, ctx.edges);

  if (collected.aggregations.length === 0) {
    logicLogger.debug(`[${LOG_PREFIX}] checkMissingGroupBy — no aggregation nodes found`);
    return [];
  }

  // Gather all non-aggregated SELECT columns from table nodes
  const nonAggregatedColumns: string[] = [];
  for (const table of collected.tables) {
    const data = table.data as QueryTableNodeData;
    for (const col of data.selectedColumns) {
      nonAggregatedColumns.push(data.tableName ? `${data.tableName}.${col}` : col);
    }
  }

  if (nonAggregatedColumns.length === 0) {
    logicLogger.debug(`[${LOG_PREFIX}] checkMissingGroupBy — no non-aggregated columns in SELECT`);
    return [];
  }

  // Check if GROUP BY exists
  if (collected.groupBys.length === 0) {
    logicLogger.warn(`[${LOG_PREFIX}] missing GROUP BY — aggregation with non-aggregated columns`, {
      aggregationCount: collected.aggregations.length,
      nonAggregatedColumns
    });
    return [{
      code: 'MISSING_GROUP_BY',
      severity: 'error',
      message: `Aggregation function used with non-aggregated columns (${nonAggregatedColumns.join(', ')}). Add a GROUP BY clause for these columns.`,
      nodeId: collected.aggregations[0].id
    }];
  }

  // Check that every non-aggregated column appears in GROUP BY
  const groupByAttrs = new Set<string>();
  for (const gb of collected.groupBys) {
    const data = gb.data as QueryGroupByNodeData;
    for (const attr of data.attributes) {
      if (attr) groupByAttrs.add(attr);
    }
  }

  const missing = nonAggregatedColumns.filter((col) => !groupByAttrs.has(col));
  if (missing.length > 0) {
    logicLogger.warn(`[${LOG_PREFIX}] GROUP BY does not cover all non-aggregated columns`, {
      missing,
      groupByAttrs: Array.from(groupByAttrs)
    });
    return [{
      code: 'INCOMPLETE_GROUP_BY',
      severity: 'error',
      message: `Non-aggregated column(s) ${missing.join(', ')} must appear in GROUP BY clause.`,
      nodeId: collected.groupBys[0].id
    }];
  }

  logicLogger.debug(`[${LOG_PREFIX}] checkMissingGroupBy — all non-aggregated columns covered by GROUP BY`);
  return [];
};

/**
 * Rule: HAVING clause requires a GROUP BY Node.
 */
export const checkHavingWithoutGroupBy = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  if (ctx.mode !== 'read') {
    return [];
  }

  const outputNode = ctx.nodes.find((n) => n.type === 'query-output');
  if (!outputNode) return [];

  const collected = collectUpstreamNodes(outputNode.id, ctx.nodes, ctx.edges);

  if (collected.havings.length > 0 && collected.groupBys.length === 0) {
    logicLogger.warn(`[${LOG_PREFIX}] HAVING clause without GROUP BY`, {
      havingCount: collected.havings.length
    });
    return [{
      code: 'HAVING_WITHOUT_GROUP_BY',
      severity: 'error',
      message: 'HAVING clause requires a GROUP BY clause.',
      nodeId: collected.havings[0].id
    }];
  }

  return [];
};

/**
 * Rule: Output node requires at least one table.
 */
export const checkNoTableConnected = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  const outputNode = ctx.nodes.find((n) => n.type === 'query-output');
  if (!outputNode) return [];

  const hasInflowEdge = ctx.edges.some((e) => e.target === outputNode.id);
  if (!hasInflowEdge) {
    logicLogger.debug(`[${LOG_PREFIX}] checkNoTableConnected — output node has no incoming edges`);
    return [];
  }

  const collected = collectUpstreamNodes(outputNode.id, ctx.nodes, ctx.edges);
  if (collected.tables.length === 0) {
    logicLogger.warn(`[${LOG_PREFIX}] no table nodes connected to output`, {
      outputNodeId: outputNode.id
    });
    return [{
      code: 'NO_TABLE_CONNECTED',
      severity: 'error',
      message: 'Query requires at least one table node connected to the output.',
      nodeId: outputNode.id
    }];
  }

  return [];
};

/**
 * Rule: Table node must have a table selected.
 */
export const checkTableNodeIncomplete = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  const diagnostics: QueryValidationDiagnostic[] = [];

  for (const node of ctx.nodes) {
    if (node.type !== 'query-table') continue;
    const data = node.data as QueryTableNodeData;
    if (!data.tableName) {
      logicLogger.info(`[${LOG_PREFIX}] table node missing table selection`, { nodeId: node.id });
      diagnostics.push({
        code: 'TABLE_NOT_SELECTED',
        severity: 'error',
        message: 'Table node has no table selected.',
        nodeId: node.id
      });
    }
  }

  return diagnostics;
};

/**
 * Rule: Join node must have both tables and attributes configured.
 */
export const checkJoinNodeIncomplete = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  const diagnostics: QueryValidationDiagnostic[] = [];

  for (const node of ctx.nodes) {
    if (node.type !== 'query-join') continue;
    const data = node.data as QueryJoinNodeData;
    const missing: string[] = [];

    if (!data.tableA) missing.push('left table');
    if (!data.tableB) missing.push('right table');
    if (!data.attributeA) missing.push('left attribute');
    if (!data.attributeB) missing.push('right attribute');

    if (missing.length > 0) {
      logicLogger.info(`[${LOG_PREFIX}] join node incomplete`, { nodeId: node.id, missing });
      diagnostics.push({
        code: 'JOIN_INCOMPLETE',
        severity: 'error',
        message: `JOIN node is missing: ${missing.join(', ')}.`,
        nodeId: node.id
      });
    }
  }

  return diagnostics;
};

/**
 * Rule: WHERE / HAVING nodes should have at least a left operand set.
 */
export const checkFilterNodeIncomplete = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  const diagnostics: QueryValidationDiagnostic[] = [];

  for (const node of ctx.nodes) {
    if (node.type !== 'query-where' && node.type !== 'query-having') continue;
    const data = node.data as QueryWhereNodeData;
    const label = node.type === 'query-where' ? 'WHERE' : 'HAVING';

    if (!data.leftOperand) {
      logicLogger.info(`[${LOG_PREFIX}] ${label} node missing left operand`, { nodeId: node.id });
      diagnostics.push({
        code: 'FILTER_MISSING_OPERAND',
        severity: 'warning',
        message: `${label} clause is missing a left operand.`,
        nodeId: node.id
      });
    }

    const isUnary = data.operator === 'is null' || data.operator === 'is not null';
    if (!isUnary && !data.rightOperand) {
      logicLogger.info(`[${LOG_PREFIX}] ${label} node missing right operand`, { nodeId: node.id, operator: data.operator });
      diagnostics.push({
        code: 'FILTER_MISSING_OPERAND',
        severity: 'warning',
        message: `${label} clause with '${data.operator}' is missing a right operand.`,
        nodeId: node.id
      });
    }
  }

  return diagnostics;
};

/**
 * Rule: ORDER BY node should have at least one sort attribute configured.
 */
export const checkOrderByIncomplete = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  const diagnostics: QueryValidationDiagnostic[] = [];

  for (const node of ctx.nodes) {
    if (node.type !== 'query-orderby') continue;
    const data = node.data as QueryOrderByNodeData;
    const configured = data.sortAttributes.filter(Boolean);
    if (configured.length === 0) {
      logicLogger.info(`[${LOG_PREFIX}] ORDER BY node has no attributes`, { nodeId: node.id });
      diagnostics.push({
        code: 'ORDER_BY_EMPTY',
        severity: 'warning',
        message: 'ORDER BY clause has no sort attributes configured.',
        nodeId: node.id
      });
    }
  }

  return diagnostics;
};

/**
 * Rule: GROUP BY node should have at least one attribute.
 */
export const checkGroupByEmpty = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  const diagnostics: QueryValidationDiagnostic[] = [];

  for (const node of ctx.nodes) {
    if (node.type !== 'query-groupby') continue;
    const data = node.data as QueryGroupByNodeData;
    const configured = data.attributes.filter(Boolean);
    if (configured.length === 0) {
      logicLogger.info(`[${LOG_PREFIX}] GROUP BY node has no attributes`, { nodeId: node.id });
      diagnostics.push({
        code: 'GROUP_BY_EMPTY',
        severity: 'warning',
        message: 'GROUP BY clause has no grouping attributes configured.',
        nodeId: node.id
      });
    }
  }

  return diagnostics;
};

/**
 * Rule: DELETE or UPDATE without WHERE is dangerous.
 */
export const checkDangerousOperation = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  if (ctx.mode !== 'delete' && ctx.mode !== 'update') return [];

  const outputNode = ctx.nodes.find((n) => n.type === 'query-output');
  if (!outputNode) return [];

  const collected = collectUpstreamNodes(outputNode.id, ctx.nodes, ctx.edges);

  if (collected.tables.length > 0 && collected.wheres.length === 0) {
    const label = ctx.mode === 'delete' ? 'DELETE' : 'UPDATE';
    logicLogger.warn(`[${LOG_PREFIX}] ${label} without WHERE`, {
      mode: ctx.mode,
      tableCount: collected.tables.length
    });
    return [{
      code: 'DANGEROUS_NO_WHERE',
      severity: 'warning',
      message: `${label} without a WHERE clause will affect all rows in the table.`,
      nodeId: outputNode.id
    }];
  }

  return [];
};

/**
 * Rule: LIMIT node should have a limit value configured.
 */
export const checkLimitIncomplete = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  const diagnostics: QueryValidationDiagnostic[] = [];

  for (const node of ctx.nodes) {
    if (node.type !== 'query-limit') continue;
    const data = node.data as QueryLimitNodeData;
    if (data.limitValue === undefined && data.offsetValue === undefined) {
      logicLogger.info(`[${LOG_PREFIX}] LIMIT node has no value`, { nodeId: node.id });
      diagnostics.push({
        code: 'LIMIT_EMPTY',
        severity: 'warning',
        message: 'LIMIT node has no limit or offset value set.',
        nodeId: node.id
      });
    }
  }

  return diagnostics;
};

/**
 * Rule: Attribute node should have table and attribute selected.
 */
export const checkAttributeIncomplete = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  const diagnostics: QueryValidationDiagnostic[] = [];

  for (const node of ctx.nodes) {
    if (node.type !== 'query-attribute') continue;
    const data = node.data as QueryAttributeNodeData;
    if (!data.tableName || !data.attributeName) {
      logicLogger.info(`[${LOG_PREFIX}] attribute node incomplete`, {
        nodeId: node.id,
        tableName: data.tableName,
        attributeName: data.attributeName
      });
      diagnostics.push({
        code: 'ATTRIBUTE_INCOMPLETE',
        severity: 'warning',
        message: 'Attribute node is missing table or attribute selection.',
        nodeId: node.id
      });
    }
  }

  return diagnostics;
};

/**
 * Rule: Detect disconnected query nodes (nodes not reachable from the output).
 */
export const checkDisconnectedNodes = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  const outputNode = ctx.nodes.find((n) => n.type === 'query-output');
  if (!outputNode) return [];

  // Collect all nodes reachable from output
  const reachable = new Set<string>();
  const walk = (nodeId: string) => {
    if (reachable.has(nodeId)) return;
    reachable.add(nodeId);
    for (const edge of ctx.edges) {
      if (edge.target === nodeId) walk(edge.source);
    }
  };
  walk(outputNode.id);

  const diagnostics: QueryValidationDiagnostic[] = [];
  const queryNodeTypes = new Set([
    'query-table', 'query-join', 'query-where', 'query-groupby',
    'query-having', 'query-orderby', 'query-limit', 'query-aggregation',
    'query-attribute', 'query-argument'
  ]);

  for (const node of ctx.nodes) {
    if (node.type === 'query-output') continue;
    if (!queryNodeTypes.has(node.type ?? '')) continue;
    if (!reachable.has(node.id)) {
      logicLogger.info(`[${LOG_PREFIX}] disconnected node detected`, { nodeId: node.id, nodeType: node.type });
      diagnostics.push({
        code: 'DISCONNECTED_NODE',
        severity: 'warning',
        message: `${(node.type ?? '').replace('query-', '').toUpperCase()} node is not connected to the output.`,
        nodeId: node.id
      });
    }
  }

  return diagnostics;
};

/**
 * Rule: Verify that columns referenced in ORDER BY are valid when a
 * schema is available.
 */
export const checkOrderByColumnsExist = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  if (ctx.mode !== 'read' || !ctx.schema) return [];

  const outputNode = ctx.nodes.find((n) => n.type === 'query-output');
  if (!outputNode) return [];

  const collected = collectUpstreamNodes(outputNode.id, ctx.nodes, ctx.edges);
  if (collected.orderBys.length === 0 || collected.tables.length === 0) return [];

  // Build set of valid column references from tables
  const validColumns = new Set<string>();
  for (const table of collected.tables) {
    const data = table.data as QueryTableNodeData;
    const schemaTable = ctx.schema.tables.find((t) => t.name === data.tableName);
    if (!schemaTable) continue;
    for (const field of schemaTable.fields) {
      validColumns.add(`${data.tableName}.${field.name}`);
      validColumns.add(field.name);
    }
  }

  const diagnostics: QueryValidationDiagnostic[] = [];
  for (const ob of collected.orderBys) {
    const data = ob.data as QueryOrderByNodeData;
    for (const attr of data.sortAttributes) {
      if (attr && !validColumns.has(attr)) {
        logicLogger.warn(`[${LOG_PREFIX}] ORDER BY references unknown column`, {
          nodeId: ob.id,
          column: attr,
          validColumns: Array.from(validColumns)
        });
        diagnostics.push({
          code: 'ORDER_BY_UNKNOWN_COLUMN',
          severity: 'warning',
          message: `ORDER BY references '${attr}' which is not a known column.`,
          nodeId: ob.id
        });
      }
    }
  }

  return diagnostics;
};

// ── Main validation entry point ──────────────────────────────────────

/** All registered validation rules. */
const validationRules: Array<(ctx: QueryValidationContext) => QueryValidationDiagnostic[]> = [
  checkNoTableConnected,
  checkTableNodeIncomplete,
  checkJoinNodeIncomplete,
  checkFilterNodeIncomplete,
  checkMissingGroupBy,
  checkHavingWithoutGroupBy,
  checkGroupByEmpty,
  checkOrderByIncomplete,
  checkOrderByColumnsExist,
  checkLimitIncomplete,
  checkAttributeIncomplete,
  checkDangerousOperation,
  checkDisconnectedNodes
];

/**
 * Run all validation rules against the current query graph and return
 * a flat list of diagnostics sorted errors-first.
 */
export const validateQuery = (ctx: QueryValidationContext): QueryValidationDiagnostic[] => {
  logicLogger.debug(`[${LOG_PREFIX}] running validation`, {
    nodeCount: ctx.nodes.length,
    edgeCount: ctx.edges.length,
    mode: ctx.mode,
    ruleCount: validationRules.length
  });

  const diagnostics: QueryValidationDiagnostic[] = [];

  for (const rule of validationRules) {
    try {
      const results = rule(ctx);
      diagnostics.push(...results);
    } catch (err) {
      logicLogger.error(`[${LOG_PREFIX}] validation rule threw an error`, {
        ruleName: rule.name,
        error: (err as Error).message
      });
    }
  }

  // Sort errors before warnings
  diagnostics.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'error' ? -1 : 1;
  });

  logicLogger.info(`[${LOG_PREFIX}] validation complete`, {
    errorCount: diagnostics.filter((d) => d.severity === 'error').length,
    warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
    totalDiagnostics: diagnostics.length
  });

  return diagnostics;
};
