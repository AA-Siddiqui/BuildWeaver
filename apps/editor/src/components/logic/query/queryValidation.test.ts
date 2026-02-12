import type { Node, Edge } from 'reactflow';
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
  QueryOutputNodeData,
  DatabaseSchema,
  LogicEditorNodeData
} from '@buildweaver/libs';
import {
  validateQuery,
  checkMissingGroupBy,
  checkHavingWithoutGroupBy,
  checkNoTableConnected,
  checkTableNodeIncomplete,
  checkJoinNodeIncomplete,
  checkFilterNodeIncomplete,
  checkOrderByIncomplete,
  checkGroupByEmpty,
  checkDangerousOperation,
  checkLimitIncomplete,
  checkAttributeIncomplete,
  checkDisconnectedNodes,
  checkOrderByColumnsExist,
  QueryValidationContext
} from './queryValidation';

jest.mock('../../../lib/logger', () => ({
  logicLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const pos = { x: 0, y: 0 };

// ── Test schema ─────────────────────────────────────────────────────

const usersTable: DatabaseSchema['tables'][0] = {
  id: 't-users',
  name: 'users',
  fields: [
    { id: 'f-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
    { id: 'f-name', name: 'name', type: 'string', nullable: false, unique: false },
    { id: 'f-email', name: 'email', type: 'string', nullable: false, unique: true },
    { id: 'f-age', name: 'age', type: 'number', nullable: true, unique: false }
  ]
};

const ordersTable: DatabaseSchema['tables'][0] = {
  id: 't-orders',
  name: 'orders',
  fields: [
    { id: 'f-oid', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
    { id: 'f-uid', name: 'user_id', type: 'uuid', nullable: false, unique: false },
    { id: 'f-total', name: 'total', type: 'number', nullable: false, unique: false }
  ]
};

const testSchema: DatabaseSchema = {
  id: 'schema-1',
  name: 'TestDB',
  tables: [usersTable, ordersTable],
  relationships: []
};

// ── Factory helpers ─────────────────────────────────────────────────

const makeTable = (id: string, tableName: string, cols: string[] = []): Node<LogicEditorNodeData> => ({
  id,
  type: 'query-table',
  position: pos,
  data: {
    kind: 'query-table',
    tableId: `tid-${id}`,
    tableName,
    schemaId: 's1',
    selectedColumns: cols,
    columnDefaults: {},
    aggregationInputCount: 0
  } as QueryTableNodeData
});

const makeAgg = (id: string, fn: 'count' | 'sum' | 'avg' | 'min' | 'max', attr?: string, table?: string): Node<LogicEditorNodeData> => ({
  id,
  type: 'query-aggregation',
  position: pos,
  data: {
    kind: 'query-aggregation',
    function: fn,
    attribute: attr,
    tableName: table
  } as QueryAggregationNodeData
});

const makeGroupBy = (id: string, attrs: string[]): Node<LogicEditorNodeData> => ({
  id,
  type: 'query-groupby',
  position: pos,
  data: {
    kind: 'query-groupby',
    groupingAttributeCount: attrs.length,
    attributes: attrs
  } as QueryGroupByNodeData
});

const makeOutput = (id = 'output'): Node<LogicEditorNodeData> => ({
  id,
  type: 'query-output',
  position: pos,
  data: { kind: 'query-output', outputId: id } as QueryOutputNodeData
});

const makeWhere = (id: string, left?: string, op = '=', right?: string): Node<LogicEditorNodeData> => ({
  id,
  type: 'query-where',
  position: pos,
  data: {
    kind: 'query-where',
    operator: op,
    leftOperand: left,
    rightOperand: right,
    leftIsColumn: true,
    rightIsColumn: false
  } as QueryWhereNodeData
});

const makeHaving = (id: string, left?: string, op = '>', right?: string): Node<LogicEditorNodeData> => ({
  id,
  type: 'query-having',
  position: pos,
  data: {
    kind: 'query-having',
    operator: op,
    leftOperand: left,
    rightOperand: right,
    leftIsColumn: true,
    rightIsColumn: false
  } as QueryHavingNodeData
});

const makeJoin = (
  id: string,
  tableA?: string,
  tableB?: string,
  attrA?: string,
  attrB?: string
): Node<LogicEditorNodeData> => ({
  id,
  type: 'query-join',
  position: pos,
  data: {
    kind: 'query-join',
    joinType: 'inner',
    tableA,
    tableB,
    attributeA: attrA,
    attributeB: attrB
  } as QueryJoinNodeData
});

const makeOrderBy = (id: string, attrs: string[], orders: string[] = []): Node<LogicEditorNodeData> => ({
  id,
  type: 'query-orderby',
  position: pos,
  data: {
    kind: 'query-orderby',
    sortCount: attrs.length || 1,
    sortAttributes: attrs,
    sortOrders: orders.length ? orders : attrs.map(() => 'asc')
  } as QueryOrderByNodeData
});

const makeLimit = (id: string, limit?: number, offset?: number): Node<LogicEditorNodeData> => ({
  id,
  type: 'query-limit',
  position: pos,
  data: { kind: 'query-limit', limitValue: limit, offsetValue: offset } as QueryLimitNodeData
});

const makeAttr = (id: string, table?: string, attr?: string): Node<LogicEditorNodeData> => ({
  id,
  type: 'query-attribute',
  position: pos,
  data: { kind: 'query-attribute', tableName: table, attributeName: attr } as QueryAttributeNodeData
});

const edge = (source: string, target: string, id?: string): Edge => ({
  id: id ?? `${source}->${target}`,
  source,
  target
});

const ctx = (
  nodes: Node<LogicEditorNodeData>[],
  edges: Edge[],
  mode: 'read' | 'insert' | 'update' | 'delete' = 'read',
  schema: DatabaseSchema | null = testSchema
): QueryValidationContext => ({ nodes, edges, mode, schema });

// ── checkMissingGroupBy ─────────────────────────────────────────────

describe('checkMissingGroupBy', () => {
  it('returns MISSING_GROUP_BY when aggregation used with non-aggregated columns and no GROUP BY', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeAgg('a1', 'count'),
      makeOutput()
    ];
    const edges = [edge('t1', 'a1'), edge('a1', 'output')];
    const result = checkMissingGroupBy(ctx(nodes, edges));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('MISSING_GROUP_BY');
    expect(result[0].severity).toBe('error');
    expect(result[0].message).toContain('users.name');
  });

  it('returns INCOMPLETE_GROUP_BY when GROUP BY does not cover all non-aggregated columns', () => {
    const nodes = [
      makeTable('t1', 'users', ['name', 'email']),
      makeAgg('a1', 'count'),
      makeGroupBy('gb1', ['users.name']),
      makeOutput()
    ];
    const edges = [edge('t1', 'a1'), edge('a1', 'gb1'), edge('gb1', 'output')];
    const result = checkMissingGroupBy(ctx(nodes, edges));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('INCOMPLETE_GROUP_BY');
    expect(result[0].message).toContain('users.email');
  });

  it('returns no diagnostics when GROUP BY covers all non-aggregated columns', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeAgg('a1', 'count'),
      makeGroupBy('gb1', ['users.name']),
      makeOutput()
    ];
    const edges = [edge('t1', 'a1'), edge('a1', 'gb1'), edge('gb1', 'output')];
    const result = checkMissingGroupBy(ctx(nodes, edges));
    expect(result).toHaveLength(0);
  });

  it('returns no diagnostics when no aggregation nodes exist', () => {
    const nodes = [makeTable('t1', 'users', ['name']), makeOutput()];
    const edges = [edge('t1', 'output')];
    const result = checkMissingGroupBy(ctx(nodes, edges));
    expect(result).toHaveLength(0);
  });

  it('returns no diagnostics for non-read mode', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeAgg('a1', 'count'),
      makeOutput()
    ];
    const edges = [edge('t1', 'a1'), edge('a1', 'output')];
    const result = checkMissingGroupBy(ctx(nodes, edges, 'insert'));
    expect(result).toHaveLength(0);
  });

  it('returns no diagnostics for aggregation-only query (no non-aggregated columns)', () => {
    const nodes = [
      makeTable('t1', 'users', []),
      makeAgg('a1', 'count'),
      makeOutput()
    ];
    const edges = [edge('t1', 'a1'), edge('a1', 'output')];
    const result = checkMissingGroupBy(ctx(nodes, edges));
    expect(result).toHaveLength(0);
  });
});

// ── checkHavingWithoutGroupBy ───────────────────────────────────────

describe('checkHavingWithoutGroupBy', () => {
  it('returns error when HAVING exists without GROUP BY', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeHaving('h1', 'COUNT(*)', '>', '5'),
      makeOutput()
    ];
    const edges = [edge('t1', 'h1'), edge('h1', 'output')];
    const result = checkHavingWithoutGroupBy(ctx(nodes, edges));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('HAVING_WITHOUT_GROUP_BY');
    expect(result[0].severity).toBe('error');
  });

  it('returns no diagnostics when HAVING has GROUP BY', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeGroupBy('gb1', ['users.name']),
      makeHaving('h1', 'COUNT(*)', '>', '5'),
      makeOutput()
    ];
    const edges = [edge('t1', 'gb1'), edge('gb1', 'h1'), edge('h1', 'output')];
    const result = checkHavingWithoutGroupBy(ctx(nodes, edges));
    expect(result).toHaveLength(0);
  });

  it('returns no diagnostics for non-read mode', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeHaving('h1', 'COUNT(*)', '>', '5'),
      makeOutput()
    ];
    const edges = [edge('t1', 'h1'), edge('h1', 'output')];
    const result = checkHavingWithoutGroupBy(ctx(nodes, edges, 'update'));
    expect(result).toHaveLength(0);
  });
});

// ── checkNoTableConnected ───────────────────────────────────────────

describe('checkNoTableConnected', () => {
  it('returns error when output has incoming edges but no table upstream', () => {
    const whereOnly = makeWhere('w1', 'x', '=', 'y');
    const nodes = [whereOnly, makeOutput()];
    const edges = [edge('w1', 'output')];
    const result = checkNoTableConnected(ctx(nodes, edges));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('NO_TABLE_CONNECTED');
  });

  it('returns no diagnostics when output has no edges (initial state)', () => {
    const nodes = [makeOutput()];
    const result = checkNoTableConnected(ctx(nodes, []));
    expect(result).toHaveLength(0);
  });

  it('returns no diagnostics when table is connected', () => {
    const nodes = [makeTable('t1', 'users'), makeOutput()];
    const edges = [edge('t1', 'output')];
    const result = checkNoTableConnected(ctx(nodes, edges));
    expect(result).toHaveLength(0);
  });
});

// ── checkTableNodeIncomplete ────────────────────────────────────────

describe('checkTableNodeIncomplete', () => {
  it('returns error for table node without table name', () => {
    const nodes = [makeTable('t1', ''), makeOutput()];
    const result = checkTableNodeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('TABLE_NOT_SELECTED');
    expect(result[0].nodeId).toBe('t1');
  });

  it('returns no diagnostics when table is configured', () => {
    const nodes = [makeTable('t1', 'users')];
    const result = checkTableNodeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(0);
  });
});

// ── checkJoinNodeIncomplete ─────────────────────────────────────────

describe('checkJoinNodeIncomplete', () => {
  it('returns error for fully unconfigured join node', () => {
    const nodes = [makeJoin('j1')];
    const result = checkJoinNodeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('JOIN_INCOMPLETE');
    expect(result[0].message).toContain('left table');
  });

  it('returns error for partially configured join node', () => {
    const nodes = [makeJoin('j1', 'users', 'orders')];
    const result = checkJoinNodeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('left attribute');
    expect(result[0].message).toContain('right attribute');
  });

  it('returns no diagnostics for fully configured join', () => {
    const nodes = [makeJoin('j1', 'users', 'orders', 'id', 'user_id')];
    const result = checkJoinNodeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(0);
  });
});

// ── checkFilterNodeIncomplete ───────────────────────────────────────

describe('checkFilterNodeIncomplete', () => {
  it('returns warnings for WHERE node missing both operands', () => {
    const nodes = [makeWhere('w1')];
    const result = checkFilterNodeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.code === 'FILTER_MISSING_OPERAND')).toBe(true);
    expect(result.every((d) => d.severity === 'warning')).toBe(true);
  });

  it('returns one warning for WHERE missing right operand only', () => {
    const nodes = [makeWhere('w1', 'users.id')];
    const result = checkFilterNodeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('right operand');
  });

  it('does not flag unary operators (IS NULL) for missing right operand', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'w1',
      type: 'query-where',
      position: pos,
      data: {
        kind: 'query-where',
        operator: 'is null',
        leftOperand: 'users.age',
        leftIsColumn: true,
        rightIsColumn: false
      } as QueryWhereNodeData
    };
    const result = checkFilterNodeIncomplete(ctx([node], []));
    expect(result).toHaveLength(0);
  });

  it('returns warnings for HAVING node missing operands', () => {
    const nodes = [makeHaving('h1')];
    const result = checkFilterNodeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(2);
    expect(result[0].message).toContain('HAVING');
  });

  it('returns no diagnostics when WHERE is fully configured', () => {
    const nodes = [makeWhere('w1', 'users.id', '=', '1')];
    const result = checkFilterNodeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(0);
  });
});

// ── checkOrderByIncomplete ──────────────────────────────────────────

describe('checkOrderByIncomplete', () => {
  it('returns warning when ORDER BY has no attributes', () => {
    const nodes = [makeOrderBy('ob1', [])];
    const result = checkOrderByIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('ORDER_BY_EMPTY');
  });

  it('returns no diagnostics when ORDER BY has attributes', () => {
    const nodes = [makeOrderBy('ob1', ['users.name'])];
    const result = checkOrderByIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(0);
  });
});

// ── checkGroupByEmpty ───────────────────────────────────────────────

describe('checkGroupByEmpty', () => {
  it('returns warning when GROUP BY has no attributes', () => {
    const nodes = [makeGroupBy('gb1', [])];
    const result = checkGroupByEmpty(ctx(nodes, []));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('GROUP_BY_EMPTY');
  });

  it('filters out empty strings from attribute check', () => {
    const nodes = [makeGroupBy('gb1', ['', ''])];
    const result = checkGroupByEmpty(ctx(nodes, []));
    expect(result).toHaveLength(1);
  });

  it('returns no diagnostics when GROUP BY has valid attributes', () => {
    const nodes = [makeGroupBy('gb1', ['users.name'])];
    const result = checkGroupByEmpty(ctx(nodes, []));
    expect(result).toHaveLength(0);
  });
});

// ── checkDangerousOperation ─────────────────────────────────────────

describe('checkDangerousOperation', () => {
  it('returns warning for DELETE without WHERE', () => {
    const nodes = [makeTable('t1', 'users'), makeOutput()];
    const edges = [edge('t1', 'output')];
    const result = checkDangerousOperation(ctx(nodes, edges, 'delete'));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('DANGEROUS_NO_WHERE');
    expect(result[0].severity).toBe('warning');
    expect(result[0].message).toContain('DELETE');
  });

  it('returns warning for UPDATE without WHERE', () => {
    const nodes = [makeTable('t1', 'users', ['name']), makeOutput()];
    const edges = [edge('t1', 'output')];
    const result = checkDangerousOperation(ctx(nodes, edges, 'update'));
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('UPDATE');
  });

  it('returns no diagnostics for DELETE with WHERE', () => {
    const nodes = [makeTable('t1', 'users'), makeWhere('w1', 'users.id', '=', '1'), makeOutput()];
    const edges = [edge('t1', 'w1'), edge('w1', 'output')];
    const result = checkDangerousOperation(ctx(nodes, edges, 'delete'));
    expect(result).toHaveLength(0);
  });

  it('returns no diagnostics for read mode', () => {
    const nodes = [makeTable('t1', 'users'), makeOutput()];
    const edges = [edge('t1', 'output')];
    const result = checkDangerousOperation(ctx(nodes, edges, 'read'));
    expect(result).toHaveLength(0);
  });

  it('returns no diagnostics for insert mode', () => {
    const nodes = [makeTable('t1', 'users'), makeOutput()];
    const edges = [edge('t1', 'output')];
    const result = checkDangerousOperation(ctx(nodes, edges, 'insert'));
    expect(result).toHaveLength(0);
  });
});

// ── checkLimitIncomplete ────────────────────────────────────────────

describe('checkLimitIncomplete', () => {
  it('returns warning when LIMIT has neither value nor offset', () => {
    const nodes = [makeLimit('l1')];
    const result = checkLimitIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('LIMIT_EMPTY');
  });

  it('returns no diagnostics when LIMIT has a value', () => {
    const nodes = [makeLimit('l1', 10)];
    const result = checkLimitIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(0);
  });

  it('returns no diagnostics when LIMIT has only an offset', () => {
    const nodes = [makeLimit('l1', undefined, 5)];
    const result = checkLimitIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(0);
  });
});

// ── checkAttributeIncomplete ────────────────────────────────────────

describe('checkAttributeIncomplete', () => {
  it('returns warning when attribute node has no table or attribute', () => {
    const nodes = [makeAttr('a1')];
    const result = checkAttributeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('ATTRIBUTE_INCOMPLETE');
  });

  it('returns warning when attribute node is missing attribute name', () => {
    const nodes = [makeAttr('a1', 'users')];
    const result = checkAttributeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(1);
  });

  it('returns no diagnostics when attribute is complete', () => {
    const nodes = [makeAttr('a1', 'users', 'email')];
    const result = checkAttributeIncomplete(ctx(nodes, []));
    expect(result).toHaveLength(0);
  });
});

// ── checkDisconnectedNodes ──────────────────────────────────────────

describe('checkDisconnectedNodes', () => {
  it('reports disconnected query nodes', () => {
    const nodes = [
      makeTable('t1', 'users'),
      makeTable('t2', 'orders'),
      makeOutput()
    ];
    const edges = [edge('t1', 'output')]; // t2 not connected
    const result = checkDisconnectedNodes(ctx(nodes, edges));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('DISCONNECTED_NODE');
    expect(result[0].nodeId).toBe('t2');
  });

  it('returns no diagnostics when all nodes are reachable', () => {
    const nodes = [makeTable('t1', 'users'), makeWhere('w1', 'users.id', '=', '1'), makeOutput()];
    const edges = [edge('t1', 'w1'), edge('w1', 'output')];
    const result = checkDisconnectedNodes(ctx(nodes, edges));
    expect(result).toHaveLength(0);
  });

  it('reports multiple disconnected nodes', () => {
    const nodes = [
      makeTable('t1', 'users'),
      makeWhere('w1', 'x', '=', 'y'),
      makeOrderBy('ob1', ['users.name']),
      makeOutput()
    ];
    const edges = [edge('t1', 'output')]; // w1 and ob1 not connected
    const result = checkDisconnectedNodes(ctx(nodes, edges));
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.nodeId).sort()).toEqual(['ob1', 'w1']);
  });

  it('does not report disconnected nodes when no output node exists', () => {
    const nodes = [makeTable('t1', 'users')];
    const result = checkDisconnectedNodes(ctx(nodes, []));
    expect(result).toHaveLength(0);
  });
});

// ── checkOrderByColumnsExist ────────────────────────────────────────

describe('checkOrderByColumnsExist', () => {
  it('returns warning for ORDER BY referencing unknown column', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeOrderBy('ob1', ['users.nonexistent']),
      makeOutput()
    ];
    const edges = [edge('t1', 'ob1'), edge('ob1', 'output')];
    const result = checkOrderByColumnsExist(ctx(nodes, edges));
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('ORDER_BY_UNKNOWN_COLUMN');
    expect(result[0].message).toContain('nonexistent');
  });

  it('returns no diagnostics for valid ORDER BY column', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeOrderBy('ob1', ['users.name']),
      makeOutput()
    ];
    const edges = [edge('t1', 'ob1'), edge('ob1', 'output')];
    const result = checkOrderByColumnsExist(ctx(nodes, edges));
    expect(result).toHaveLength(0);
  });

  it('accepts unqualified column names', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeOrderBy('ob1', ['name']),
      makeOutput()
    ];
    const edges = [edge('t1', 'ob1'), edge('ob1', 'output')];
    const result = checkOrderByColumnsExist(ctx(nodes, edges));
    expect(result).toHaveLength(0);
  });

  it('skips check when no schema is provided', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeOrderBy('ob1', ['users.bogus']),
      makeOutput()
    ];
    const edges = [edge('t1', 'ob1'), edge('ob1', 'output')];
    const result = checkOrderByColumnsExist(ctx(nodes, edges, 'read', null));
    expect(result).toHaveLength(0);
  });
});

// ── validateQuery (integration) ─────────────────────────────────────

describe('validateQuery', () => {
  it('returns empty array for a valid simple SELECT query', () => {
    const nodes = [makeTable('t1', 'users', ['name', 'email']), makeOutput()];
    const edges = [edge('t1', 'output')];
    const diagnostics = validateQuery(ctx(nodes, edges));
    expect(diagnostics).toHaveLength(0);
  });

  it('detects multiple errors in a single query', () => {
    const nodes = [
      makeTable('t1', ''),            // TABLE_NOT_SELECTED
      makeJoin('j1'),                  // JOIN_INCOMPLETE + DISCONNECTED
      makeWhere('w1'),                 // FILTER_MISSING_OPERAND x2 + DISCONNECTED
      makeOutput()
    ];
    const edges = [edge('t1', 'output')];
    const diagnostics = validateQuery(ctx(nodes, edges));
    expect(diagnostics.length).toBeGreaterThanOrEqual(3);
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain('TABLE_NOT_SELECTED');
    expect(codes).toContain('JOIN_INCOMPLETE');
  });

  it('sorts errors before warnings', () => {
    const nodes = [
      makeTable('t1', ''),            // error: TABLE_NOT_SELECTED
      makeLimit('l1'),                 // warning: LIMIT_EMPTY
      makeOutput()
    ];
    const edges = [edge('t1', 'l1'), edge('l1', 'output')];
    const diagnostics = validateQuery(ctx(nodes, edges));
    const severities = diagnostics.map((d) => d.severity);
    const firstWarning = severities.indexOf('warning');
    const lastError = severities.lastIndexOf('error');
    if (firstWarning >= 0 && lastError >= 0) {
      expect(lastError).toBeLessThan(firstWarning);
    }
  });

  it('detects aggregate with GROUP BY mismatch in complex query', () => {
    const nodes = [
      makeTable('t1', 'users', ['name', 'email']),
      makeAgg('a1', 'count'),
      makeGroupBy('gb1', ['users.name']), // missing users.email
      makeOutput()
    ];
    const edges = [
      edge('t1', 'a1'),
      edge('a1', 'gb1'),
      edge('gb1', 'output')
    ];
    const diagnostics = validateQuery(ctx(nodes, edges));
    const groupByIssue = diagnostics.find((d) => d.code === 'INCOMPLETE_GROUP_BY');
    expect(groupByIssue).toBeDefined();
    expect(groupByIssue?.message).toContain('users.email');
  });

  it('returns clean for a valid aggregation query with proper GROUP BY', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeAgg('a1', 'count'),
      makeGroupBy('gb1', ['users.name']),
      makeOutput()
    ];
    const edges = [
      edge('t1', 'a1'),
      edge('a1', 'gb1'),
      edge('gb1', 'output')
    ];
    const diagnostics = validateQuery(ctx(nodes, edges));
    // May have no errors (or only warnings for non-critical things)
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('catches HAVING without GROUP BY alongside other errors', () => {
    const nodes = [
      makeTable('t1', 'users', ['name']),
      makeHaving('h1', 'COUNT(*)', '>', '5'),
      makeOutput()
    ];
    const edges = [edge('t1', 'h1'), edge('h1', 'output')];
    const diagnostics = validateQuery(ctx(nodes, edges));
    const havingIssue = diagnostics.find((d) => d.code === 'HAVING_WITHOUT_GROUP_BY');
    expect(havingIssue).toBeDefined();
  });

  it('handles empty graph gracefully', () => {
    const diagnostics = validateQuery(ctx([], []));
    expect(diagnostics).toHaveLength(0);
  });

  it('handles output-only graph gracefully', () => {
    const nodes = [makeOutput()];
    const diagnostics = validateQuery(ctx(nodes, []));
    // No inflow edges means no "NO_TABLE_CONNECTED" either
    expect(diagnostics).toHaveLength(0);
  });

  it('catches DELETE without WHERE', () => {
    const nodes = [makeTable('t1', 'users'), makeOutput()];
    const edges = [edge('t1', 'output')];
    const diagnostics = validateQuery(ctx(nodes, edges, 'delete'));
    const dangerous = diagnostics.find((d) => d.code === 'DANGEROUS_NO_WHERE');
    expect(dangerous).toBeDefined();
    expect(dangerous?.severity).toBe('warning');
  });

  it('does not crash when a rule throws', () => {
    // We can test this indirectly by verifying validateQuery always returns an array.
    // Passing weird data should still produce valid output.
    const weirdNode: Node<LogicEditorNodeData> = {
      id: 'x',
      type: 'query-table' as string,
      position: pos,
      data: null as unknown as LogicEditorNodeData
    };
    // This may cause individual rules to throw, but validateQuery should catch them.
    const diagnostics = validateQuery(ctx([weirdNode, makeOutput()], []));
    expect(Array.isArray(diagnostics)).toBe(true);
  });
});
