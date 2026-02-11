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
  QueryArgumentNodeData,
  QueryOutputNodeData,
  DatabaseSchema,
  LogicEditorNodeData
} from '@buildweaver/libs';
import {
  buildTableSqlFragment,
  buildWhereSqlFragment,
  buildJoinSqlFragment,
  buildGroupBySqlFragment,
  buildHavingSqlFragment,
  buildOrderBySqlFragment,
  buildLimitSqlFragment,
  buildAggregationSqlFragment,
  buildAttributeSqlFragment,
  buildArgumentSqlFragment,
  inferTableDataShape,
  inferJoinDataShape,
  inferAggregationDataShape,
  inferAttributeDataShape,
  assembleFullSql,
  inferFullDataShape,
  collectUpstreamNodes,
  evaluateQueryNodePreview
} from './queryPreview';

jest.mock('../../../lib/logger', () => ({
  logicLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const basePosition = { x: 0, y: 0 };

const makeSchema = (tables: DatabaseSchema['tables'] = []): DatabaseSchema => ({
  id: 'schema-1',
  name: 'TestSchema',
  tables,
  relationships: []
});

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
    { id: 'f-user-id', name: 'user_id', type: 'uuid', nullable: false, unique: false },
    { id: 'f-total', name: 'total', type: 'number', nullable: false, unique: false },
    { id: 'f-created', name: 'created_at', type: 'datetime', nullable: false, unique: false }
  ]
};

const testSchema = makeSchema([usersTable, ordersTable]);

// ── buildTableSqlFragment ───────────────────────────────────────────

describe('buildTableSqlFragment', () => {
  const baseData: QueryTableNodeData = {
    kind: 'query-table',
    tableId: 't1',
    tableName: 'users',
    schemaId: 's1',
    selectedColumns: [],
    columnDefaults: {},
    aggregationInputCount: 0
  };

  it('generates SELECT * for read mode with no selected columns', () => {
    const sql = buildTableSqlFragment(baseData, 'read');
    expect(sql).toBe('SELECT users.*\nFROM users');
  });

  it('generates SELECT with listed columns for read mode', () => {
    const data = { ...baseData, selectedColumns: ['name', 'email'] };
    const sql = buildTableSqlFragment(data, 'read');
    expect(sql).toBe('SELECT users.name, users.email\nFROM users');
  });

  it('generates INSERT with column defaults', () => {
    const data = { ...baseData, columnDefaults: { name: 'John', email: 'j@test.com' } };
    const sql = buildTableSqlFragment(data, 'insert');
    expect(sql).toContain('INSERT INTO users');
    expect(sql).toContain('VALUES');
    expect(sql).toContain("'John'");
    expect(sql).toContain("'j@test.com'");
  });

  it('generates INSERT with placeholder when no defaults exist', () => {
    const data = { ...baseData, selectedColumns: ['name'] };
    const sql = buildTableSqlFragment(data, 'insert');
    expect(sql).toContain('INSERT INTO users (name)');
    expect(sql).toContain('VALUES (?)');
  });

  it('generates UPDATE with SET for selected columns', () => {
    const data = { ...baseData, selectedColumns: ['name', 'email'], columnDefaults: { name: 'Jane' } };
    const sql = buildTableSqlFragment(data, 'update');
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain("name = 'Jane'");
    expect(sql).toContain('email = ?');
  });

  it('generates UPDATE with comment when no columns configured', () => {
    const sql = buildTableSqlFragment(baseData, 'update');
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('columns not configured');
  });

  it('generates DELETE FROM', () => {
    const sql = buildTableSqlFragment(baseData, 'delete');
    expect(sql).toBe('DELETE FROM users');
  });

  it('returns comment when table name is empty', () => {
    const data = { ...baseData, tableName: '' };
    const sql = buildTableSqlFragment(data, 'read');
    expect(sql).toContain('no table selected');
  });
});

// ── buildWhereSqlFragment ───────────────────────────────────────────

describe('buildWhereSqlFragment', () => {
  it('builds WHERE with column operands', () => {
    const data: QueryWhereNodeData = {
      kind: 'query-where',
      operator: '=',
      leftOperand: 'users.name',
      rightOperand: 'orders.user_id',
      leftIsColumn: true,
      rightIsColumn: true
    };
    expect(buildWhereSqlFragment(data)).toBe('WHERE users.name = orders.user_id');
  });

  it('builds WHERE with value operands', () => {
    const data: QueryWhereNodeData = {
      kind: 'query-where',
      operator: '>',
      leftOperand: 'users.age',
      rightOperand: '18',
      leftIsColumn: true,
      rightIsColumn: false
    };
    expect(buildWhereSqlFragment(data)).toBe("WHERE users.age > '18'");
  });

  it('builds WHERE with IS NULL (unary)', () => {
    const data: QueryWhereNodeData = {
      kind: 'query-where',
      operator: 'is null',
      leftOperand: 'users.age',
      leftIsColumn: true,
      rightIsColumn: false
    };
    expect(buildWhereSqlFragment(data)).toBe('WHERE users.age IS NULL');
  });

  it('builds WHERE with IS NOT NULL (unary)', () => {
    const data: QueryWhereNodeData = {
      kind: 'query-where',
      operator: 'is not null',
      leftOperand: 'users.email',
      leftIsColumn: true,
      rightIsColumn: false
    };
    expect(buildWhereSqlFragment(data)).toBe('WHERE users.email IS NOT NULL');
  });

  it('uses placeholders when operands are missing', () => {
    const data: QueryWhereNodeData = {
      kind: 'query-where',
      operator: '=',
      leftIsColumn: true,
      rightIsColumn: false
    };
    expect(buildWhereSqlFragment(data)).toBe('WHERE ? = ?');
  });
});

// ── buildJoinSqlFragment ────────────────────────────────────────────

describe('buildJoinSqlFragment', () => {
  it('builds INNER JOIN', () => {
    const data: QueryJoinNodeData = {
      kind: 'query-join',
      joinType: 'inner',
      tableA: 'users',
      tableB: 'orders',
      attributeA: 'id',
      attributeB: 'user_id'
    };
    const sql = buildJoinSqlFragment(data);
    expect(sql).toContain('INNER JOIN orders');
    expect(sql).toContain('ON users.id = orders.user_id');
  });

  it('builds LEFT JOIN', () => {
    const data: QueryJoinNodeData = {
      kind: 'query-join',
      joinType: 'left',
      tableA: 'users',
      tableB: 'orders',
      attributeA: 'id',
      attributeB: 'user_id'
    };
    expect(buildJoinSqlFragment(data)).toContain('LEFT JOIN');
  });

  it('builds FULL OUTER JOIN', () => {
    const data: QueryJoinNodeData = {
      kind: 'query-join',
      joinType: 'full',
      tableA: 'users',
      tableB: 'orders',
      attributeA: 'id',
      attributeB: 'user_id'
    };
    expect(buildJoinSqlFragment(data)).toContain('FULL OUTER JOIN');
  });

  it('uses placeholders when tables are undefined', () => {
    const data: QueryJoinNodeData = { kind: 'query-join', joinType: 'inner' };
    const sql = buildJoinSqlFragment(data);
    expect(sql).toContain('INNER JOIN ?');
    expect(sql).toContain('ON ? = ?');
  });
});

// ── buildGroupBySqlFragment ─────────────────────────────────────────

describe('buildGroupBySqlFragment', () => {
  it('builds GROUP BY with attributes', () => {
    const data: QueryGroupByNodeData = {
      kind: 'query-groupby',
      groupingAttributeCount: 2,
      attributes: ['users.name', 'users.age']
    };
    expect(buildGroupBySqlFragment(data)).toBe('GROUP BY users.name, users.age');
  });

  it('uses placeholder when no attributes', () => {
    const data: QueryGroupByNodeData = {
      kind: 'query-groupby',
      groupingAttributeCount: 1,
      attributes: []
    };
    expect(buildGroupBySqlFragment(data)).toBe('GROUP BY ?');
  });

  it('filters out empty attribute strings', () => {
    const data: QueryGroupByNodeData = {
      kind: 'query-groupby',
      groupingAttributeCount: 2,
      attributes: ['users.name', '']
    };
    expect(buildGroupBySqlFragment(data)).toBe('GROUP BY users.name');
  });
});

// ── buildHavingSqlFragment ──────────────────────────────────────────

describe('buildHavingSqlFragment', () => {
  it('builds HAVING clause', () => {
    const data: QueryHavingNodeData = {
      kind: 'query-having',
      operator: '>',
      leftOperand: 'COUNT(*)',
      rightOperand: '5',
      leftIsColumn: true,
      rightIsColumn: false
    };
    expect(buildHavingSqlFragment(data)).toBe("HAVING COUNT(*) > '5'");
  });

  it('builds HAVING with IS NULL', () => {
    const data: QueryHavingNodeData = {
      kind: 'query-having',
      operator: 'is null',
      leftOperand: 'users.age',
      leftIsColumn: true,
      rightIsColumn: false
    };
    expect(buildHavingSqlFragment(data)).toBe('HAVING users.age IS NULL');
  });
});

// ── buildOrderBySqlFragment ─────────────────────────────────────────

describe('buildOrderBySqlFragment', () => {
  it('builds single sort criterion', () => {
    const data: QueryOrderByNodeData = {
      kind: 'query-orderby',
      sortCount: 1,
      sortAttributes: ['users.name'],
      sortOrders: ['asc']
    };
    expect(buildOrderBySqlFragment(data)).toBe('ORDER BY users.name ASC');
  });

  it('builds multiple sort criteria', () => {
    const data: QueryOrderByNodeData = {
      kind: 'query-orderby',
      sortCount: 2,
      sortAttributes: ['users.name', 'users.age'],
      sortOrders: ['asc', 'desc']
    };
    expect(buildOrderBySqlFragment(data)).toBe('ORDER BY users.name ASC, users.age DESC');
  });

  it('uses placeholder for missing attributes', () => {
    const data: QueryOrderByNodeData = {
      kind: 'query-orderby',
      sortCount: 1,
      sortAttributes: [],
      sortOrders: []
    };
    expect(buildOrderBySqlFragment(data)).toBe('ORDER BY ? ASC');
  });
});

// ── buildLimitSqlFragment ───────────────────────────────────────────

describe('buildLimitSqlFragment', () => {
  it('builds LIMIT only', () => {
    const data: QueryLimitNodeData = { kind: 'query-limit', limitValue: 10 };
    expect(buildLimitSqlFragment(data)).toBe('LIMIT 10');
  });

  it('builds LIMIT and OFFSET', () => {
    const data: QueryLimitNodeData = { kind: 'query-limit', limitValue: 10, offsetValue: 20 };
    expect(buildLimitSqlFragment(data)).toBe('LIMIT 10 OFFSET 20');
  });

  it('builds OFFSET only', () => {
    const data: QueryLimitNodeData = { kind: 'query-limit', offsetValue: 5 };
    expect(buildLimitSqlFragment(data)).toBe('OFFSET 5');
  });

  it('returns LIMIT ? when neither is set', () => {
    const data: QueryLimitNodeData = { kind: 'query-limit' };
    expect(buildLimitSqlFragment(data)).toBe('LIMIT ?');
  });
});

// ── buildAggregationSqlFragment ─────────────────────────────────────

describe('buildAggregationSqlFragment', () => {
  it('builds COUNT(*)', () => {
    const data: QueryAggregationNodeData = { kind: 'query-aggregation', function: 'count' };
    expect(buildAggregationSqlFragment(data)).toBe('COUNT(*)');
  });

  it('builds SUM with table-qualified attribute', () => {
    const data: QueryAggregationNodeData = {
      kind: 'query-aggregation',
      function: 'sum',
      attribute: 'total',
      tableName: 'orders'
    };
    expect(buildAggregationSqlFragment(data)).toBe('SUM(orders.total)');
  });

  it('builds AVG without table name', () => {
    const data: QueryAggregationNodeData = {
      kind: 'query-aggregation',
      function: 'avg',
      attribute: 'age'
    };
    expect(buildAggregationSqlFragment(data)).toBe('AVG(age)');
  });
});

// ── buildAttributeSqlFragment ───────────────────────────────────────

describe('buildAttributeSqlFragment', () => {
  it('builds table.column', () => {
    const data: QueryAttributeNodeData = {
      kind: 'query-attribute',
      tableName: 'users',
      attributeName: 'email'
    };
    expect(buildAttributeSqlFragment(data)).toBe('users.email');
  });

  it('returns placeholder when both are missing', () => {
    const data: QueryAttributeNodeData = { kind: 'query-attribute' };
    expect(buildAttributeSqlFragment(data)).toBe('?');
  });

  it('returns attribute name alone when table is missing', () => {
    const data: QueryAttributeNodeData = { kind: 'query-attribute', attributeName: 'email' };
    expect(buildAttributeSqlFragment(data)).toBe('email');
  });
});

// ── buildArgumentSqlFragment ────────────────────────────────────────

describe('buildArgumentSqlFragment', () => {
  it('builds :paramName', () => {
    const data: QueryArgumentNodeData = {
      kind: 'query-argument',
      argumentId: 'arg-1',
      name: 'userId',
      type: 'string'
    };
    expect(buildArgumentSqlFragment(data)).toBe(':userId');
  });

  it('falls back to :param when name is empty', () => {
    const data: QueryArgumentNodeData = {
      kind: 'query-argument',
      argumentId: 'arg-1',
      name: '',
      type: 'string'
    };
    expect(buildArgumentSqlFragment(data)).toBe(':param');
  });
});

// ── inferTableDataShape ─────────────────────────────────────────────

describe('inferTableDataShape', () => {
  const baseData: QueryTableNodeData = {
    kind: 'query-table',
    tableId: 't1',
    tableName: 'users',
    schemaId: 's1',
    selectedColumns: [],
    columnDefaults: {},
    aggregationInputCount: 0
  };

  it('returns all columns when none selected in read mode', () => {
    const shape = inferTableDataShape(baseData, testSchema, 'read');
    expect(shape).toHaveLength(4);
    expect(shape[0]).toEqual({ name: 'id', type: 'uuid', table: 'users' });
    expect(shape[1]).toEqual({ name: 'name', type: 'string', table: 'users' });
  });

  it('returns only selected columns in read mode', () => {
    const data = { ...baseData, selectedColumns: ['name', 'email'] };
    const shape = inferTableDataShape(data, testSchema, 'read');
    expect(shape).toHaveLength(2);
    expect(shape[0].name).toBe('name');
    expect(shape[1].name).toBe('email');
  });

  it('returns affected_rows for delete mode', () => {
    const shape = inferTableDataShape(baseData, testSchema, 'delete');
    expect(shape).toEqual([{ name: 'affected_rows', type: 'number' }]);
  });

  it('returns columns from defaults for insert mode', () => {
    const data = { ...baseData, columnDefaults: { name: 'John', email: 'j@test.com' } };
    const shape = inferTableDataShape(data, testSchema, 'insert');
    expect(shape).toHaveLength(2);
    expect(shape[0].name).toBe('name');
    expect(shape[1].name).toBe('email');
  });

  it('returns empty array when schema is null', () => {
    const shape = inferTableDataShape(baseData, null, 'read');
    expect(shape).toHaveLength(0);
  });

  it('marks unknown type when column not found in schema', () => {
    const data = { ...baseData, selectedColumns: ['nonexistent'] };
    const shape = inferTableDataShape(data, testSchema, 'read');
    expect(shape).toHaveLength(1);
    expect(shape[0].type).toBe('unknown');
  });
});

// ── inferJoinDataShape ──────────────────────────────────────────────

describe('inferJoinDataShape', () => {
  it('combines columns from two tables', () => {
    const data: QueryJoinNodeData = {
      kind: 'query-join',
      joinType: 'inner',
      tableA: 'users',
      tableB: 'orders'
    };
    const shape = inferJoinDataShape(data, testSchema);
    expect(shape.length).toBe(usersTable.fields.length + ordersTable.fields.length);
    expect(shape.filter((c) => c.table === 'users')).toHaveLength(usersTable.fields.length);
    expect(shape.filter((c) => c.table === 'orders')).toHaveLength(ordersTable.fields.length);
  });

  it('returns empty array when tables are undefined', () => {
    const data: QueryJoinNodeData = { kind: 'query-join', joinType: 'inner' };
    const shape = inferJoinDataShape(data, testSchema);
    expect(shape).toHaveLength(0);
  });
});

// ── inferAggregationDataShape ───────────────────────────────────────

describe('inferAggregationDataShape', () => {
  it('returns single number column for COUNT', () => {
    const data: QueryAggregationNodeData = { kind: 'query-aggregation', function: 'count' };
    const shape = inferAggregationDataShape(data);
    expect(shape).toHaveLength(1);
    expect(shape[0]).toEqual({ name: 'COUNT(*)', type: 'number' });
  });

  it('returns named column for SUM', () => {
    const data: QueryAggregationNodeData = {
      kind: 'query-aggregation',
      function: 'sum',
      attribute: 'total'
    };
    const shape = inferAggregationDataShape(data);
    expect(shape).toEqual([{ name: 'SUM(total)', type: 'number' }]);
  });
});

// ── inferAttributeDataShape ─────────────────────────────────────────

describe('inferAttributeDataShape', () => {
  it('returns column with type from schema', () => {
    const data: QueryAttributeNodeData = {
      kind: 'query-attribute',
      tableName: 'users',
      attributeName: 'email'
    };
    const shape = inferAttributeDataShape(data, testSchema);
    expect(shape).toEqual([{ name: 'email', type: 'string', table: 'users' }]);
  });

  it('returns empty array when table or attribute missing', () => {
    const data: QueryAttributeNodeData = { kind: 'query-attribute' };
    expect(inferAttributeDataShape(data, testSchema)).toHaveLength(0);
  });
});

// ── collectUpstreamNodes ────────────────────────────────────────────

describe('collectUpstreamNodes', () => {
  it('collects nodes reachable from the start node', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'table-1',
        type: 'query-table',
        position: basePosition,
        data: {
          kind: 'query-table',
          tableId: 't1',
          tableName: 'users',
          schemaId: 's1',
          selectedColumns: ['name'],
          columnDefaults: {},
          aggregationInputCount: 0
        }
      },
      {
        id: 'where-1',
        type: 'query-where',
        position: basePosition,
        data: {
          kind: 'query-where',
          operator: '=',
          leftOperand: 'users.name',
          rightOperand: 'Alice',
          leftIsColumn: true,
          rightIsColumn: false
        }
      },
      {
        id: 'output-1',
        type: 'query-output',
        position: basePosition,
        data: { kind: 'query-output', outputId: 'output-1' }
      }
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'table-1', target: 'where-1', sourceHandle: 'output', targetHandle: 'input-data' },
      { id: 'e2', source: 'where-1', target: 'output-1', sourceHandle: 'output', targetHandle: 'input' }
    ];

    const collected = collectUpstreamNodes('output-1', nodes, edges);
    expect(collected.tables).toHaveLength(1);
    expect(collected.wheres).toHaveLength(1);
    expect(collected.joins).toHaveLength(0);
  });

  it('handles disconnected output node', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'output-1',
        type: 'query-output',
        position: basePosition,
        data: { kind: 'query-output', outputId: 'output-1' }
      }
    ];

    const collected = collectUpstreamNodes('output-1', nodes, []);
    expect(collected.tables).toHaveLength(0);
    expect(collected.wheres).toHaveLength(0);
  });

  it('does not revisit already-visited nodes', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'table-1',
        type: 'query-table',
        position: basePosition,
        data: {
          kind: 'query-table',
          tableId: 't1',
          tableName: 'users',
          schemaId: 's1',
          selectedColumns: [],
          columnDefaults: {},
          aggregationInputCount: 0
        }
      },
      {
        id: 'output-1',
        type: 'query-output',
        position: basePosition,
        data: { kind: 'query-output', outputId: 'output-1' }
      }
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'table-1', target: 'output-1' },
      { id: 'e2', source: 'table-1', target: 'output-1' }
    ];

    const collected = collectUpstreamNodes('output-1', nodes, edges);
    expect(collected.tables).toHaveLength(1);
  });
});

// ── assembleFullSql ─────────────────────────────────────────────────

describe('assembleFullSql', () => {
  const tableNode = (id: string, tableName: string, selectedColumns: string[] = []): Node<LogicEditorNodeData> => ({
    id,
    type: 'query-table',
    position: basePosition,
    data: {
      kind: 'query-table',
      tableId: `tid-${id}`,
      tableName,
      schemaId: 's1',
      selectedColumns,
      columnDefaults: {},
      aggregationInputCount: 0
    } as QueryTableNodeData
  });

  const whereNode = (id: string, left: string, op: string, right: string): Node<LogicEditorNodeData> => ({
    id,
    type: 'query-where',
    position: basePosition,
    data: {
      kind: 'query-where',
      operator: op,
      leftOperand: left,
      rightOperand: right,
      leftIsColumn: true,
      rightIsColumn: false
    } as QueryWhereNodeData
  });

  const outputNode = (id: string): Node<LogicEditorNodeData> => ({
    id,
    type: 'query-output',
    position: basePosition,
    data: { kind: 'query-output', outputId: id } as QueryOutputNodeData
  });

  it('assembles a simple SELECT query', () => {
    const nodes = [tableNode('t1', 'users', ['name', 'email']), outputNode('out')];
    const edges: Edge[] = [{ id: 'e1', source: 't1', target: 'out' }];
    const sql = assembleFullSql('out', nodes, edges, 'read');
    expect(sql).toContain('SELECT users.name, users.email');
    expect(sql).toContain('FROM users');
  });

  it('assembles SELECT with WHERE', () => {
    const nodes = [
      tableNode('t1', 'users', ['name']),
      whereNode('w1', 'users.name', '=', 'Alice'),
      outputNode('out')
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 't1', target: 'w1' },
      { id: 'e2', source: 'w1', target: 'out' }
    ];
    const sql = assembleFullSql('out', nodes, edges, 'read');
    expect(sql).toContain('SELECT users.name');
    expect(sql).toContain('FROM users');
    expect(sql).toContain("WHERE users.name = 'Alice'");
  });

  it('assembles SELECT with JOIN', () => {
    const joinN: Node<LogicEditorNodeData> = {
      id: 'j1',
      type: 'query-join',
      position: basePosition,
      data: {
        kind: 'query-join',
        joinType: 'left',
        tableA: 'users',
        tableB: 'orders',
        attributeA: 'id',
        attributeB: 'user_id'
      } as QueryJoinNodeData
    };
    const nodes = [tableNode('t1', 'users', ['name']), joinN, outputNode('out')];
    const edges: Edge[] = [
      { id: 'e1', source: 't1', target: 'j1' },
      { id: 'e2', source: 'j1', target: 'out' }
    ];
    const sql = assembleFullSql('out', nodes, edges, 'read');
    expect(sql).toContain('LEFT JOIN orders');
    expect(sql).toContain('ON users.id = orders.user_id');
  });

  it('assembles complex query with all clauses', () => {
    const groupByN: Node<LogicEditorNodeData> = {
      id: 'gb1',
      type: 'query-groupby',
      position: basePosition,
      data: { kind: 'query-groupby', groupingAttributeCount: 1, attributes: ['users.name'] } as QueryGroupByNodeData
    };
    const orderByN: Node<LogicEditorNodeData> = {
      id: 'ob1',
      type: 'query-orderby',
      position: basePosition,
      data: { kind: 'query-orderby', sortCount: 1, sortAttributes: ['users.name'], sortOrders: ['desc'] } as QueryOrderByNodeData
    };
    const limitN: Node<LogicEditorNodeData> = {
      id: 'l1',
      type: 'query-limit',
      position: basePosition,
      data: { kind: 'query-limit', limitValue: 10, offsetValue: 5 } as QueryLimitNodeData
    };
    const nodes = [
      tableNode('t1', 'users', ['name']),
      whereNode('w1', 'users.age', '>', '18'),
      groupByN,
      orderByN,
      limitN,
      outputNode('out')
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 't1', target: 'w1' },
      { id: 'e2', source: 'w1', target: 'gb1' },
      { id: 'e3', source: 'gb1', target: 'ob1' },
      { id: 'e4', source: 'ob1', target: 'l1' },
      { id: 'e5', source: 'l1', target: 'out' }
    ];
    const sql = assembleFullSql('out', nodes, edges, 'read');
    expect(sql).toContain('SELECT users.name');
    expect(sql).toContain('FROM users');
    expect(sql).toContain("WHERE users.age > '18'");
    expect(sql).toContain('GROUP BY users.name');
    expect(sql).toContain('ORDER BY users.name DESC');
    expect(sql).toContain('LIMIT 10 OFFSET 5');
  });

  it('returns comment when no tables connected', () => {
    const nodes = [outputNode('out')];
    const sql = assembleFullSql('out', nodes, [], 'read');
    expect(sql).toContain('No tables connected');
  });

  it('assembles INSERT query', () => {
    const data = {
      kind: 'query-table' as const,
      tableId: 't1',
      tableName: 'users',
      schemaId: 's1',
      selectedColumns: ['name', 'email'],
      columnDefaults: { name: 'John' },
      aggregationInputCount: 0
    };
    const nodes: Node<LogicEditorNodeData>[] = [
      { id: 't1', type: 'query-table', position: basePosition, data },
      outputNode('out')
    ];
    const edges: Edge[] = [{ id: 'e1', source: 't1', target: 'out' }];
    const sql = assembleFullSql('out', nodes, edges, 'insert');
    expect(sql).toContain('INSERT INTO users');
  });

  it('assembles UPDATE query with WHERE', () => {
    const data: QueryTableNodeData = {
      kind: 'query-table',
      tableId: 't1',
      tableName: 'users',
      schemaId: 's1',
      selectedColumns: ['name'],
      columnDefaults: { name: 'Jane' },
      aggregationInputCount: 0
    };
    const nodes: Node<LogicEditorNodeData>[] = [
      { id: 't1', type: 'query-table', position: basePosition, data },
      whereNode('w1', 'users.id', '=', '1'),
      outputNode('out')
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 't1', target: 'w1' },
      { id: 'e2', source: 'w1', target: 'out' }
    ];
    const sql = assembleFullSql('out', nodes, edges, 'update');
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain("SET name = 'Jane'");
    expect(sql).toContain('WHERE');
  });

  it('assembles DELETE query', () => {
    const nodes = [tableNode('t1', 'users'), whereNode('w1', 'users.id', '=', '1'), outputNode('out')];
    const edges: Edge[] = [
      { id: 'e1', source: 't1', target: 'w1' },
      { id: 'e2', source: 'w1', target: 'out' }
    ];
    const sql = assembleFullSql('out', nodes, edges, 'delete');
    expect(sql).toContain('DELETE FROM users');
    expect(sql).toContain('WHERE');
  });
});

// ── inferFullDataShape ──────────────────────────────────────────────

describe('inferFullDataShape', () => {
  it('infers shape from table columns', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 't1',
        type: 'query-table',
        position: basePosition,
        data: {
          kind: 'query-table',
          tableId: 't1',
          tableName: 'users',
          schemaId: 's1',
          selectedColumns: ['name', 'email'],
          columnDefaults: {},
          aggregationInputCount: 0
        } as QueryTableNodeData
      },
      {
        id: 'out',
        type: 'query-output',
        position: basePosition,
        data: { kind: 'query-output', outputId: 'out' } as QueryOutputNodeData
      }
    ];
    const edges: Edge[] = [{ id: 'e1', source: 't1', target: 'out' }];

    const shape = inferFullDataShape('out', nodes, edges, testSchema, 'read');
    expect(shape).toHaveLength(2);
    expect(shape[0]).toEqual({ name: 'name', type: 'string', table: 'users' });
    expect(shape[1]).toEqual({ name: 'email', type: 'string', table: 'users' });
  });

  it('returns affected_rows for delete mode', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 't1',
        type: 'query-table',
        position: basePosition,
        data: {
          kind: 'query-table',
          tableId: 't1',
          tableName: 'users',
          schemaId: 's1',
          selectedColumns: [],
          columnDefaults: {},
          aggregationInputCount: 0
        } as QueryTableNodeData
      },
      {
        id: 'out',
        type: 'query-output',
        position: basePosition,
        data: { kind: 'query-output', outputId: 'out' } as QueryOutputNodeData
      }
    ];
    const edges: Edge[] = [{ id: 'e1', source: 't1', target: 'out' }];

    const shape = inferFullDataShape('out', nodes, edges, testSchema, 'delete');
    expect(shape).toEqual([{ name: 'affected_rows', type: 'number' }]);
  });

  it('includes aggregation columns', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 't1',
        type: 'query-table',
        position: basePosition,
        data: {
          kind: 'query-table',
          tableId: 't1',
          tableName: 'users',
          schemaId: 's1',
          selectedColumns: ['name'],
          columnDefaults: {},
          aggregationInputCount: 1
        } as QueryTableNodeData
      },
      {
        id: 'agg1',
        type: 'query-aggregation',
        position: basePosition,
        data: {
          kind: 'query-aggregation',
          function: 'count'
        } as QueryAggregationNodeData
      },
      {
        id: 'out',
        type: 'query-output',
        position: basePosition,
        data: { kind: 'query-output', outputId: 'out' } as QueryOutputNodeData
      }
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'agg1', target: 't1' },
      { id: 'e2', source: 't1', target: 'out' }
    ];

    const shape = inferFullDataShape('out', nodes, edges, testSchema, 'read');
    expect(shape.some((c) => c.name === 'name')).toBe(true);
    expect(shape.some((c) => c.name === 'COUNT(*)')).toBe(true);
  });
});

// ── evaluateQueryNodePreview ────────────────────────────────────────

describe('evaluateQueryNodePreview', () => {
  const defaultContext = {
    schema: testSchema,
    mode: 'read' as const,
    allNodes: [] as Node<LogicEditorNodeData>[],
    allEdges: [] as Edge[]
  };

  it('returns unknown state for table node without table name', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 't1',
      type: 'query-table',
      position: basePosition,
      data: {
        kind: 'query-table',
        tableId: '',
        tableName: '',
        schemaId: '',
        selectedColumns: [],
        columnDefaults: {},
        aggregationInputCount: 0
      }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('unknown');
    expect(preview.heading).toContain('No table');
  });

  it('returns ready state for table node with table name', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 't1',
      type: 'query-table',
      position: basePosition,
      data: {
        kind: 'query-table',
        tableId: 't1',
        tableName: 'users',
        schemaId: 's1',
        selectedColumns: ['name', 'email'],
        columnDefaults: {},
        aggregationInputCount: 0
      }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('ready');
    expect(preview.heading).toBe('users');
    expect(preview.dataShape).toHaveLength(2);
    expect(preview.sql).toContain('SELECT');
    expect(preview.sql).toContain('FROM users');
  });

  it('returns ready state for where node', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'w1',
      type: 'query-where',
      position: basePosition,
      data: {
        kind: 'query-where',
        operator: '=',
        leftOperand: 'users.id',
        rightOperand: '1',
        leftIsColumn: true,
        rightIsColumn: false
      }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('ready');
    expect(preview.heading).toBe('WHERE filter');
    expect(preview.sql).toContain('WHERE');
  });

  it('returns ready state for join node', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'j1',
      type: 'query-join',
      position: basePosition,
      data: {
        kind: 'query-join',
        joinType: 'inner',
        tableA: 'users',
        tableB: 'orders',
        attributeA: 'id',
        attributeB: 'user_id'
      }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('ready');
    expect(preview.heading).toBe('INNER JOIN');
    expect(preview.sql).toContain('INNER JOIN');
    expect(preview.dataShape!.length).toBeGreaterThan(0);
  });

  it('returns ready state for aggregation node', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'a1',
      type: 'query-aggregation',
      position: basePosition,
      data: {
        kind: 'query-aggregation',
        function: 'count'
      }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('ready');
    expect(preview.heading).toBe('Aggregation');
    expect(preview.sql).toBe('COUNT(*)');
    expect(preview.dataShape).toHaveLength(1);
  });

  it('returns ready state for argument node', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'arg1',
      type: 'query-argument',
      position: basePosition,
      data: {
        kind: 'query-argument',
        argumentId: 'arg1',
        name: 'userId',
        type: 'string'
      }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('ready');
    expect(preview.heading).toBe('userId');
    expect(preview.sql).toBe(':userId');
  });

  it('returns unknown state for attribute node without selections', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'at1',
      type: 'query-attribute',
      position: basePosition,
      data: { kind: 'query-attribute' }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('unknown');
    expect(preview.summary).toContain('Select table');
  });

  it('returns ready state for attribute node with selections', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'at1',
      type: 'query-attribute',
      position: basePosition,
      data: { kind: 'query-attribute', tableName: 'users', attributeName: 'email' }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('ready');
    expect(preview.sql).toBe('users.email');
    expect(preview.dataShape).toHaveLength(1);
  });

  it('returns ready state for limit node', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'l1',
      type: 'query-limit',
      position: basePosition,
      data: { kind: 'query-limit', limitValue: 25, offsetValue: 10 }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('ready');
    expect(preview.sql).toBe('LIMIT 25 OFFSET 10');
  });

  it('returns ready state for group-by node', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'gb1',
      type: 'query-groupby',
      position: basePosition,
      data: {
        kind: 'query-groupby',
        groupingAttributeCount: 1,
        attributes: ['users.name']
      }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('ready');
    expect(preview.heading).toBe('GROUP BY');
    expect(preview.sql).toBe('GROUP BY users.name');
  });

  it('returns ready state for having node', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'h1',
      type: 'query-having',
      position: basePosition,
      data: {
        kind: 'query-having',
        operator: '>',
        leftOperand: 'COUNT(*)',
        rightOperand: '5',
        leftIsColumn: true,
        rightIsColumn: false
      }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('ready');
    expect(preview.heading).toBe('HAVING filter');
    expect(preview.sql).toContain('HAVING');
  });

  it('returns ready state for order-by node', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'ob1',
      type: 'query-orderby',
      position: basePosition,
      data: {
        kind: 'query-orderby',
        sortCount: 1,
        sortAttributes: ['users.name'],
        sortOrders: ['asc']
      }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('ready');
    expect(preview.heading).toBe('ORDER BY');
    expect(preview.sql).toBe('ORDER BY users.name ASC');
  });

  it('assembles full SQL for output node', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 't1',
        type: 'query-table',
        position: basePosition,
        data: {
          kind: 'query-table',
          tableId: 't1',
          tableName: 'users',
          schemaId: 's1',
          selectedColumns: ['name'],
          columnDefaults: {},
          aggregationInputCount: 0
        }
      },
      {
        id: 'out',
        type: 'query-output',
        position: basePosition,
        data: { kind: 'query-output', outputId: 'out' }
      }
    ];
    const edges: Edge[] = [{ id: 'e1', source: 't1', target: 'out' }];

    const context = { ...defaultContext, allNodes: nodes, allEdges: edges };
    const outputNodeRef = nodes.find((n) => n.id === 'out')!;
    const preview = evaluateQueryNodePreview(outputNodeRef, context);
    expect(preview.state).toBe('ready');
    expect(preview.heading).toBe('Query Result');
    expect(preview.sql).toContain('SELECT users.name');
    expect(preview.sql).toContain('FROM users');
    expect(preview.dataShape).toHaveLength(1);
    expect(preview.dataShape![0].name).toBe('name');
  });

  it('returns unknown for output node with no upstream tables', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'out',
        type: 'query-output',
        position: basePosition,
        data: { kind: 'query-output', outputId: 'out' }
      }
    ];
    const context = { ...defaultContext, allNodes: nodes, allEdges: [] };
    const preview = evaluateQueryNodePreview(nodes[0], context);
    expect(preview.state).toBe('unknown');
    expect(preview.summary).toContain('Connect table');
  });

  it('returns unknown for unrecognised node type', () => {
    const node: Node<LogicEditorNodeData> = {
      id: 'x1',
      type: 'unknown-type' as string,
      position: basePosition,
      data: { kind: 'query-table' as const, tableId: '', tableName: '', schemaId: '', selectedColumns: [], columnDefaults: {}, aggregationInputCount: 0 }
    };
    const preview = evaluateQueryNodePreview(node, defaultContext);
    expect(preview.state).toBe('unknown');
  });
});
