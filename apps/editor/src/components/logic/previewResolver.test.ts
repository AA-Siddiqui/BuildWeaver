import type { Edge, Node } from 'reactflow';
import type {
  LogicEditorNodeData,
  LogicEditorNode,
  LogicEditorEdge,
  DummyNodeData,
  StringNodeData,
  ListNodeData,
  ConditionalNodeData,
  FunctionArgumentNodeData,
  FunctionReturnNodeData,
  FunctionNodeData,
  LogicalOperatorNodeData,
  QueryNodeData,
  QueryDefinition,
  DatabaseSchema,
  UserDefinedFunction,
  QueryTableNodeData,
  QueryJoinNodeData,
  QueryWhereNodeData,
  QueryGroupByNodeData,
  QueryHavingNodeData,
  QueryOrderByNodeData,
  QueryLimitNodeData,
  QueryAggregationNodeData,
  QueryAttributeNodeData,
  QueryArgumentNodeData,
  QueryOutputNodeData
} from '@buildweaver/libs';
import { createPreviewResolver } from './previewResolver';
import { getConditionalHandleId } from './conditionalHandles';
import { getLogicalHandleId } from './logicalOperatorConfig';

describe('previewResolver', () => {
  const basePosition = { x: 0, y: 0 };

  it('uses upstream values when computing previews', () => {
    const stringInputId = 'input-a';
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'dummy-1',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Sample string',
          description: 'source',
          sample: { type: 'string', value: 'hello world' }
        } satisfies DummyNodeData
      },
      {
        id: 'string-1',
        type: 'string',
        position: basePosition,
        data: {
          kind: 'string',
          label: 'Upper',
          operation: 'uppercase',
          stringInputs: [{ id: stringInputId, label: 'Primary', sampleValue: '' }],
          options: {}
        } satisfies StringNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-1',
        source: 'dummy-1',
        target: 'string-1',
        sourceHandle: 'dummy-output',
        targetHandle: `string-${stringInputId}`
      }
    ];

    const resolver = createPreviewResolver(nodes, edges);
    const preview = resolver.getNodePreview('string-1');
    expect(preview.summary).toBe('HELLO WORLD');

    const binding = resolver.getHandleBinding('string-1', `string-${stringInputId}`);
    expect(binding?.sourceLabel).toBe('Sample string');
    expect(binding?.value).toBe('hello world');
  });

  it('merges list bindings across primary and secondary handles', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'dummy-primary',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Primary list',
          sample: { type: 'list', value: [1, 2, 3] }
        } satisfies DummyNodeData
      },
      {
        id: 'dummy-secondary',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Secondary list',
          sample: { type: 'list', value: [4, 5] }
        } satisfies DummyNodeData
      },
      {
        id: 'list-1',
        type: 'list',
        position: basePosition,
        data: {
          kind: 'list',
          label: 'Appender',
          operation: 'append',
          primarySample: [],
          secondarySample: [],
          sort: 'asc'
        } satisfies ListNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-a',
        source: 'dummy-primary',
        target: 'list-1',
        sourceHandle: 'dummy-output',
        targetHandle: 'list-list-1-primary'
      },
      {
        id: 'edge-b',
        source: 'dummy-secondary',
        target: 'list-1',
        sourceHandle: 'dummy-output',
        targetHandle: 'list-list-1-secondary'
      }
    ];

    const resolver = createPreviewResolver(nodes, edges);
    const preview = resolver.getNodePreview('list-1');
    expect(preview.value).toEqual([1, 2, 3, 4, 5]);
  });

  it('uses numeric bindings for list slice indices', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'dummy-list',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'List source',
          sample: { type: 'list', value: [10, 11, 12, 13] }
        } satisfies DummyNodeData
      },
      {
        id: 'dummy-start',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Start index',
          sample: { type: 'integer', value: 1 }
        } satisfies DummyNodeData
      },
      {
        id: 'dummy-end',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'End index',
          sample: { type: 'integer', value: 3 }
        } satisfies DummyNodeData
      },
      {
        id: 'list-slice',
        type: 'list',
        position: basePosition,
        data: {
          kind: 'list',
          label: 'Slicer',
          operation: 'slice',
          primarySample: [],
          secondarySample: [],
          startSample: 0,
          endSample: 0,
          sort: 'asc'
        } satisfies ListNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-primary',
        source: 'dummy-list',
        target: 'list-slice',
        sourceHandle: 'dummy-out',
        targetHandle: 'list-list-slice-primary'
      },
      {
        id: 'edge-start',
        source: 'dummy-start',
        target: 'list-slice',
        sourceHandle: 'dummy-out',
        targetHandle: 'list-list-slice-start'
      },
      {
        id: 'edge-end',
        source: 'dummy-end',
        target: 'list-slice',
        sourceHandle: 'dummy-out',
        targetHandle: 'list-list-slice-end'
      }
    ];

    const resolver = createPreviewResolver(nodes, edges);
    const preview = resolver.getNodePreview('list-slice');
    expect(preview.value).toEqual([11, 12]);
  });

  it('marks target handles unavailable once a connection exists', () => {
    const resolver = createPreviewResolver([], [
      { id: 'edge-1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }
    ]);

    expect(resolver.isHandleAvailable({ target: 'b', targetHandle: 'in' })).toBe(false);
    expect(resolver.isHandleAvailable({ target: 'b', targetHandle: 'other' })).toBe(true);
  });

  it('evaluates conditional nodes using upstream bindings', () => {
    const conditionalId = 'conditional-node';
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'condition-source',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Condition',
          sample: { type: 'boolean', value: true }
        } satisfies DummyNodeData
      },
      {
        id: 'true-source',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'True branch',
          sample: { type: 'string', value: 'truthy-value' }
        } satisfies DummyNodeData
      },
      {
        id: 'false-source',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'False branch',
          sample: { type: 'string', value: 'falsy-value' }
        } satisfies DummyNodeData
      },
      {
        id: conditionalId,
        type: 'conditional',
        position: basePosition,
        data: {
          kind: 'conditional',
          label: 'Conditional',
          conditionSample: false,
          trueValue: 'fallback-true',
          falseValue: 'fallback-false',
          trueValueKind: 'string',
          falseValueKind: 'string'
        } satisfies ConditionalNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-condition',
        source: 'condition-source',
        target: conditionalId,
        sourceHandle: 'dummy-output',
        targetHandle: getConditionalHandleId(conditionalId, 'condition')
      },
      {
        id: 'edge-truthy',
        source: 'true-source',
        target: conditionalId,
        sourceHandle: 'dummy-output',
        targetHandle: getConditionalHandleId(conditionalId, 'truthy')
      },
      {
        id: 'edge-falsy',
        source: 'false-source',
        target: conditionalId,
        sourceHandle: 'dummy-output',
        targetHandle: getConditionalHandleId(conditionalId, 'falsy')
      }
    ];

    const resolver = createPreviewResolver(nodes, edges);
    const preview = resolver.getNodePreview(conditionalId);
    expect(preview.summary).toContain('truthy-value');
  });

  it('supplies placeholder values for function argument nodes', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'function-argument-1',
        type: 'function-argument',
        position: basePosition,
        data: {
          kind: 'function-argument',
          argumentId: 'arg-1',
          name: 'Threshold',
          type: 'number'
        } satisfies FunctionArgumentNodeData
      }
    ];

    const resolver = createPreviewResolver(nodes, []);
    expect(resolver.getNodePreview('function-argument-1').value).toBe(0);
  });

  it('omits placeholder values for arguments when executing a function call', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'function-argument-1',
        type: 'function-argument',
        position: basePosition,
        data: {
          kind: 'function-argument',
          argumentId: 'arg-1',
          name: 'Threshold',
          type: 'number'
        } satisfies FunctionArgumentNodeData
      }
    ];

    const resolver = createPreviewResolver(nodes, [], { argumentValueOverrides: {} });
    expect(resolver.getNodePreview('function-argument-1').value).toBeUndefined();
  });

  it('exposes null values for applied functions without definitions', () => {
    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'function-1',
        type: 'function',
        position: basePosition,
        data: {
          kind: 'function',
          functionId: 'fn-1',
          functionName: 'Score',
          mode: 'applied',
          returnsValue: true
        } satisfies FunctionNodeData
      },
      {
        id: 'logic-1',
        type: 'logical',
        position: basePosition,
        data: {
          kind: 'logical',
          label: 'Gate',
          description: '',
          operation: 'and',
          primarySample: true,
          secondarySample: false
        } satisfies LogicalOperatorNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-connect',
        source: 'function-1',
        target: 'logic-1',
        sourceHandle: 'function-result',
        targetHandle: getLogicalHandleId('logic-1', 'primary')
      }
    ];

    const resolver = createPreviewResolver(nodes, edges);
    expect(resolver.getNodePreview('function-1').value).toBeNull();
    const binding = resolver.getHandleBinding('logic-1', getLogicalHandleId('logic-1', 'primary'));
    expect(binding?.sourceNodeId).toBe('function-1');
    expect(binding?.value).toBeNull();
  });

  it('evaluates applied function nodes using their definitions and bindings', () => {
    const functionDefinition: UserDefinedFunction = {
      id: 'fn-echo',
      name: 'Echo',
      description: 'Returns the provided number',
      nodes: [
        {
          id: 'arg-node',
          type: 'function-argument',
          position: basePosition,
          data: {
            kind: 'function-argument',
            argumentId: 'arg-input',
            name: 'Input',
            type: 'number'
          } satisfies FunctionArgumentNodeData
        },
        {
          id: 'return-node',
          type: 'function-return',
          position: basePosition,
          data: {
            kind: 'function-return',
            returnId: 'ret'
          } satisfies FunctionReturnNodeData
        }
      ] satisfies LogicEditorNode[],
      edges: [
        {
          id: 'edge-arg-return',
          source: 'arg-node',
          target: 'return-node',
          sourceHandle: 'function-argument-arg-input',
          targetHandle: 'function-return-ret'
        }
      ] satisfies LogicEditorEdge[],
      arguments: [{ id: 'arg-input', name: 'Input', type: 'number' }],
      returnsValue: true
    };

    const nodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'dummy-source',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Number source',
          sample: { type: 'integer', value: 42 }
        } satisfies DummyNodeData
      },
      {
        id: 'function-1',
        type: 'function',
        position: basePosition,
        data: {
          kind: 'function',
          functionId: 'fn-echo',
          functionName: 'Echo',
          mode: 'applied',
          returnsValue: true
        } satisfies FunctionNodeData
      },
      {
        id: 'logic-1',
        type: 'logical',
        position: basePosition,
        data: {
          kind: 'logical',
          label: 'Gate',
          description: '',
          operation: 'and',
          primarySample: true,
          secondarySample: true
        } satisfies LogicalOperatorNodeData
      }
    ];

    const edges: Edge[] = [
      {
        id: 'edge-arg',
        source: 'dummy-source',
        target: 'function-1',
        sourceHandle: 'dummy-output',
        targetHandle: 'arg-arg-input'
      },
      {
        id: 'edge-result',
        source: 'function-1',
        target: 'logic-1',
        sourceHandle: 'function-result',
        targetHandle: getLogicalHandleId('logic-1', 'primary')
      }
    ];

    const resolver = createPreviewResolver(nodes, edges, { functions: [functionDefinition] });
    const preview = resolver.getNodePreview('function-1');
    expect(preview.value).toBe(42);
    const binding = resolver.getHandleBinding('logic-1', getLogicalHandleId('logic-1', 'primary'));
    expect(binding?.value).toBe(42);
  });

  describe('main-canvas query node preview', () => {
    const testSchema: DatabaseSchema = {
      id: 'schema-1',
      name: 'TestDB',
      tables: [
        {
          id: 't-users',
          name: 'users',
          fields: [
            { id: 'f-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'f-name', name: 'name', type: 'string', nullable: false, unique: false },
            { id: 'f-email', name: 'email', type: 'string', nullable: false, unique: true }
          ]
        }
      ],
      relationships: []
    };

    const makeQueryDef = (overrides: Partial<QueryDefinition> = {}): QueryDefinition => ({
      id: 'qd-1',
      name: 'Get Users',
      mode: 'read',
      schemaId: 'schema-1',
      nodes: [
        {
          id: 'qt-1',
          type: 'query-table',
          position: basePosition,
          data: {
            kind: 'query-table',
            tableId: 't-users',
            tableName: 'users',
            schemaId: 'schema-1',
            selectedColumns: ['name', 'email'],
            columnDefaults: {},
            aggregationInputCount: 0
          }
        },
        {
          id: 'qo-1',
          type: 'query-output',
          position: basePosition,
          data: { kind: 'query-output', outputId: 'qo-1' }
        }
      ],
      edges: [
        { id: 'qe-1', source: 'qt-1', target: 'qo-1', sourceHandle: 'output', targetHandle: 'input' }
      ],
      arguments: [],
      ...overrides
    });

    it('produces SQL and data shape for a query node on the main canvas', () => {
      const queryDef = makeQueryDef();
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'main-q-1',
          type: 'query',
          position: basePosition,
          data: {
            kind: 'query',
            queryId: 'qd-1',
            queryName: 'Get Users',
            mode: 'read',
            schemaId: 'schema-1',
            arguments: []
          } satisfies QueryNodeData
        }
      ];

      const resolver = createPreviewResolver(nodes, [], {
        queryDefinitions: [queryDef],
        databases: [testSchema]
      });
      const preview = resolver.getNodePreview('main-q-1');

      expect(preview.state).toBe('ready');
      expect(preview.heading).toBe('Get Users');
      expect(preview.sql).toContain('SELECT users.name, users.email');
      expect(preview.sql).toContain('FROM users');
      expect(preview.dataShape).toBeDefined();
      expect(preview.dataShape!.length).toBe(2);
      expect(preview.dataShape![0].name).toBe('name');
      expect(preview.dataShape![1].name).toBe('email');
    });

    it('includes WHERE in SQL when query definition has a where node', () => {
      const queryDef = makeQueryDef({
        nodes: [
          {
            id: 'qt-1',
            type: 'query-table',
            position: basePosition,
            data: {
              kind: 'query-table',
              tableId: 't-users',
              tableName: 'users',
              schemaId: 'schema-1',
              selectedColumns: ['name'],
              columnDefaults: {},
              aggregationInputCount: 0
            }
          },
          {
            id: 'qw-1',
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
          },
          {
            id: 'qo-1',
            type: 'query-output',
            position: basePosition,
            data: { kind: 'query-output', outputId: 'qo-1' }
          }
        ],
        edges: [
          { id: 'qe-1', source: 'qt-1', target: 'qw-1', sourceHandle: 'output', targetHandle: 'input-data' },
          { id: 'qe-2', source: 'qw-1', target: 'qo-1', sourceHandle: 'output', targetHandle: 'input' }
        ]
      });

      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'main-q-1',
          type: 'query',
          position: basePosition,
          data: {
            kind: 'query',
            queryId: 'qd-1',
            queryName: 'Get Users',
            mode: 'read',
            schemaId: 'schema-1',
            arguments: []
          } satisfies QueryNodeData
        }
      ];

      const resolver = createPreviewResolver(nodes, [], {
        queryDefinitions: [queryDef],
        databases: [testSchema]
      });
      const preview = resolver.getNodePreview('main-q-1');

      expect(preview.sql).toContain('SELECT users.name');
      expect(preview.sql).toContain('WHERE');
    });

    it('falls back gracefully when query definition is not found', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'main-q-1',
          type: 'query',
          position: basePosition,
          data: {
            kind: 'query',
            queryId: 'nonexistent',
            queryName: 'Missing Query',
            mode: 'read',
            schemaId: 'schema-1',
            arguments: [{ id: 'a1', name: 'userId', type: 'string' }]
          } satisfies QueryNodeData
        }
      ];

      const resolver = createPreviewResolver(nodes, [], {
        queryDefinitions: [],
        databases: [testSchema]
      });
      const preview = resolver.getNodePreview('main-q-1');

      expect(preview.state).toBe('ready');
      expect(preview.heading).toBe('Missing Query');
      expect(preview.summary).toContain('READ');
      expect(preview.summary).toContain('1 argument(s)');
      expect(preview.sql).toBeUndefined();
      expect(preview.dataShape).toBeUndefined();
    });

    it('handles query definition with no output node', () => {
      const queryDef = makeQueryDef({
        nodes: [
          {
            id: 'qt-1',
            type: 'query-table',
            position: basePosition,
            data: {
              kind: 'query-table',
              tableId: 't-users',
              tableName: 'users',
              schemaId: 'schema-1',
              selectedColumns: ['name'],
              columnDefaults: {},
              aggregationInputCount: 0
            }
          }
        ],
        edges: []
      });

      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'main-q-1',
          type: 'query',
          position: basePosition,
          data: {
            kind: 'query',
            queryId: 'qd-1',
            queryName: 'Get Users',
            mode: 'read',
            schemaId: 'schema-1',
            arguments: []
          } satisfies QueryNodeData
        }
      ];

      const resolver = createPreviewResolver(nodes, [], {
        queryDefinitions: [queryDef],
        databases: [testSchema]
      });
      const preview = resolver.getNodePreview('main-q-1');

      expect(preview.state).toBe('unknown');
      expect(preview.summary).toContain('no output node');
    });

    it('produces delete SQL for delete-mode queries', () => {
      const queryDef = makeQueryDef({
        mode: 'delete',
        nodes: [
          {
            id: 'qt-1',
            type: 'query-table',
            position: basePosition,
            data: {
              kind: 'query-table',
              tableId: 't-users',
              tableName: 'users',
              schemaId: 'schema-1',
              selectedColumns: [],
              columnDefaults: {},
              aggregationInputCount: 0
            }
          },
          {
            id: 'qo-1',
            type: 'query-output',
            position: basePosition,
            data: { kind: 'query-output', outputId: 'qo-1' }
          }
        ],
        edges: [
          { id: 'qe-1', source: 'qt-1', target: 'qo-1', sourceHandle: 'output', targetHandle: 'input' }
        ]
      });

      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'main-q-1',
          type: 'query',
          position: basePosition,
          data: {
            kind: 'query',
            queryId: 'qd-1',
            queryName: 'Remove Users',
            mode: 'delete',
            schemaId: 'schema-1',
            arguments: []
          } satisfies QueryNodeData
        }
      ];

      const resolver = createPreviewResolver(nodes, [], {
        queryDefinitions: [queryDef],
        databases: [testSchema]
      });
      const preview = resolver.getNodePreview('main-q-1');

      expect(preview.sql).toContain('DELETE FROM users');
      expect(preview.dataShape).toEqual([{ name: 'affected_rows', type: 'number' }]);
    });

    it('works without database schema (unknown column types)', () => {
      const queryDef = makeQueryDef();
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'main-q-1',
          type: 'query',
          position: basePosition,
          data: {
            kind: 'query',
            queryId: 'qd-1',
            queryName: 'Get Users',
            mode: 'read',
            schemaId: 'schema-1',
            arguments: []
          } satisfies QueryNodeData
        }
      ];

      const resolver = createPreviewResolver(nodes, [], {
        queryDefinitions: [queryDef],
        databases: []
      });
      const preview = resolver.getNodePreview('main-q-1');

      expect(preview.sql).toContain('SELECT users.name, users.email');
      expect(preview.dataShape).toBeDefined();
      expect(preview.dataShape!.every((c) => c.type === 'unknown')).toBe(true);
    });
  });

  describe('query inner-node binding resolution', () => {
    const querySchema: DatabaseSchema = {
      id: 'schema-1',
      name: 'TestDB',
      tables: [
        {
          id: 't-users',
          name: 'users',
          fields: [
            { id: 'f-id', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'f-name', name: 'name', type: 'string', nullable: false, unique: false }
          ]
        },
        {
          id: 't-orders',
          name: 'orders',
          fields: [
            { id: 'f-oid', name: 'id', type: 'uuid', nullable: false, unique: true, isId: true },
            { id: 'f-uid', name: 'user_id', type: 'uuid', nullable: false, unique: false }
          ]
        }
      ],
      relationships: []
    };

    it('resolves binding when table output is connected to join input-a', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'table-1',
          type: 'query-table',
          position: basePosition,
          data: {
            kind: 'query-table',
            tableId: 't-users',
            tableName: 'users',
            schemaId: 'schema-1',
            selectedColumns: ['name'],
            columnDefaults: {},
            aggregationInputCount: 0
          } satisfies QueryTableNodeData
        },
        {
          id: 'join-1',
          type: 'query-join',
          position: basePosition,
          data: {
            kind: 'query-join',
            joinType: 'inner',
            tableA: 'users',
            tableB: 'orders',
            attributeA: 'id',
            attributeB: 'user_id'
          } satisfies QueryJoinNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'table-1',
          target: 'join-1',
          sourceHandle: 'output',
          targetHandle: 'input-a'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      const binding = resolver.getHandleBinding('join-1', 'input-a');
      expect(binding).toBeDefined();
      expect(binding!.sourceNodeId).toBe('table-1');
      expect(binding!.value).toContain('SELECT');
      expect(binding!.value).toContain('FROM users');
    });

    it('resolves binding when table output is connected to where input-data', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'table-1',
          type: 'query-table',
          position: basePosition,
          data: {
            kind: 'query-table',
            tableId: 't-users',
            tableName: 'users',
            schemaId: 'schema-1',
            selectedColumns: [],
            columnDefaults: {},
            aggregationInputCount: 0
          } satisfies QueryTableNodeData
        },
        {
          id: 'where-1',
          type: 'query-where',
          position: basePosition,
          data: {
            kind: 'query-where',
            operator: '=',
            leftOperand: 'users.id',
            rightOperand: '1',
            leftIsColumn: true,
            rightIsColumn: false
          } satisfies QueryWhereNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'table-1',
          target: 'where-1',
          sourceHandle: 'output',
          targetHandle: 'input-data'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      const binding = resolver.getHandleBinding('where-1', 'input-data');
      expect(binding).toBeDefined();
      expect(binding!.sourceNodeId).toBe('table-1');
    });

    it('resolves binding when where output is connected to output node input', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'where-1',
          type: 'query-where',
          position: basePosition,
          data: {
            kind: 'query-where',
            operator: '>',
            leftOperand: 'users.age',
            rightOperand: '18',
            leftIsColumn: true,
            rightIsColumn: false
          } satisfies QueryWhereNodeData
        },
        {
          id: 'out-1',
          type: 'query-output',
          position: basePosition,
          data: {
            kind: 'query-output',
            outputId: 'out-1'
          } satisfies QueryOutputNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'where-1',
          target: 'out-1',
          sourceHandle: 'output',
          targetHandle: 'input'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      const binding = resolver.getHandleBinding('out-1', 'input');
      expect(binding).toBeDefined();
      expect(binding!.sourceNodeId).toBe('where-1');
      expect(binding!.value).toContain('WHERE');
    });

    it('resolves binding for argument connected to where input', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'arg-1',
          type: 'query-argument',
          position: basePosition,
          data: {
            kind: 'query-argument',
            argumentId: 'arg-1',
            name: 'userId',
            type: 'string'
          } satisfies QueryArgumentNodeData
        },
        {
          id: 'where-1',
          type: 'query-where',
          position: basePosition,
          data: {
            kind: 'query-where',
            operator: '=',
            leftOperand: 'users.id',
            rightOperand: ':userId',
            leftIsColumn: true,
            rightIsColumn: false
          } satisfies QueryWhereNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'arg-1',
          target: 'where-1',
          sourceHandle: 'output',
          targetHandle: 'input-right'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      const binding = resolver.getHandleBinding('where-1', 'input-right');
      expect(binding).toBeDefined();
      expect(binding!.sourceNodeId).toBe('arg-1');
      expect(binding!.value).toBe(':userId');
    });

    it('resolves binding for aggregation connected to table', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'agg-1',
          type: 'query-aggregation',
          position: basePosition,
          data: {
            kind: 'query-aggregation',
            function: 'count'
          } satisfies QueryAggregationNodeData
        },
        {
          id: 'table-1',
          type: 'query-table',
          position: basePosition,
          data: {
            kind: 'query-table',
            tableId: 't-users',
            tableName: 'users',
            schemaId: 'schema-1',
            selectedColumns: ['name'],
            columnDefaults: {},
            aggregationInputCount: 1
          } satisfies QueryTableNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'agg-1',
          target: 'table-1',
          sourceHandle: 'output',
          targetHandle: 'input-agg-0'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      const binding = resolver.getHandleBinding('table-1', 'input-agg-0');
      expect(binding).toBeDefined();
      expect(binding!.sourceNodeId).toBe('agg-1');
      expect(binding!.value).toBe('COUNT(*)');
    });

    it('resolves binding for groupby connected to orderby', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'gb-1',
          type: 'query-groupby',
          position: basePosition,
          data: {
            kind: 'query-groupby',
            groupingAttributeCount: 1,
            attributes: ['users.name']
          } satisfies QueryGroupByNodeData
        },
        {
          id: 'ob-1',
          type: 'query-orderby',
          position: basePosition,
          data: {
            kind: 'query-orderby',
            sortCount: 1,
            sortAttributes: ['users.name'],
            sortOrders: ['asc']
          } satisfies QueryOrderByNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'gb-1',
          target: 'ob-1',
          sourceHandle: 'output',
          targetHandle: 'input-data'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      const binding = resolver.getHandleBinding('ob-1', 'input-data');
      expect(binding).toBeDefined();
      expect(binding!.sourceNodeId).toBe('gb-1');
      expect(binding!.value).toContain('GROUP BY');
    });

    it('resolves binding for limit node with data input', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'ob-1',
          type: 'query-orderby',
          position: basePosition,
          data: {
            kind: 'query-orderby',
            sortCount: 1,
            sortAttributes: ['users.name'],
            sortOrders: ['desc']
          } satisfies QueryOrderByNodeData
        },
        {
          id: 'limit-1',
          type: 'query-limit',
          position: basePosition,
          data: {
            kind: 'query-limit',
            limitValue: 10
          } satisfies QueryLimitNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'ob-1',
          target: 'limit-1',
          sourceHandle: 'output',
          targetHandle: 'input-data'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      const binding = resolver.getHandleBinding('limit-1', 'input-data');
      expect(binding).toBeDefined();
      expect(binding!.sourceNodeId).toBe('ob-1');
      expect(binding!.value).toContain('ORDER BY');
    });

    it('resolves binding for attribute connected to where', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'attr-1',
          type: 'query-attribute',
          position: basePosition,
          data: {
            kind: 'query-attribute',
            tableName: 'users',
            attributeName: 'email'
          } satisfies QueryAttributeNodeData
        },
        {
          id: 'where-1',
          type: 'query-where',
          position: basePosition,
          data: {
            kind: 'query-where',
            operator: '=',
            leftIsColumn: true,
            rightIsColumn: false
          } satisfies QueryWhereNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'attr-1',
          target: 'where-1',
          sourceHandle: 'output',
          targetHandle: 'input-left'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      const binding = resolver.getHandleBinding('where-1', 'input-left');
      expect(binding).toBeDefined();
      expect(binding!.sourceNodeId).toBe('attr-1');
      expect(binding!.value).toBe('users.email');
    });

    it('returns undefined binding for unready attribute node (no table/attribute selected)', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'attr-1',
          type: 'query-attribute',
          position: basePosition,
          data: {
            kind: 'query-attribute'
          } satisfies QueryAttributeNodeData
        },
        {
          id: 'where-1',
          type: 'query-where',
          position: basePosition,
          data: {
            kind: 'query-where',
            operator: '=',
            leftIsColumn: true,
            rightIsColumn: false
          } satisfies QueryWhereNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'attr-1',
          target: 'where-1',
          sourceHandle: 'output',
          targetHandle: 'input-left'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      const binding = resolver.getHandleBinding('where-1', 'input-left');
      expect(binding).toBeUndefined();
    });

    it('resolves binding for having connected to output', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'having-1',
          type: 'query-having',
          position: basePosition,
          data: {
            kind: 'query-having',
            operator: '>',
            leftOperand: 'COUNT(*)',
            rightOperand: '5',
            leftIsColumn: true,
            rightIsColumn: false
          } satisfies QueryHavingNodeData
        },
        {
          id: 'out-1',
          type: 'query-output',
          position: basePosition,
          data: {
            kind: 'query-output',
            outputId: 'out-1'
          } satisfies QueryOutputNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'having-1',
          target: 'out-1',
          sourceHandle: 'output',
          targetHandle: 'input'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      const binding = resolver.getHandleBinding('out-1', 'input');
      expect(binding).toBeDefined();
      expect(binding!.sourceNodeId).toBe('having-1');
      expect(binding!.value).toContain('HAVING');
    });

    it('resolves full pipeline: table -> where -> output with all bindings valid', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'table-1',
          type: 'query-table',
          position: basePosition,
          data: {
            kind: 'query-table',
            tableId: 't-users',
            tableName: 'users',
            schemaId: 'schema-1',
            selectedColumns: ['name'],
            columnDefaults: {},
            aggregationInputCount: 0
          } satisfies QueryTableNodeData
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
          } satisfies QueryWhereNodeData
        },
        {
          id: 'out-1',
          type: 'query-output',
          position: basePosition,
          data: {
            kind: 'query-output',
            outputId: 'out-1'
          } satisfies QueryOutputNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'table-1',
          target: 'where-1',
          sourceHandle: 'output',
          targetHandle: 'input-data'
        },
        {
          id: 'e2',
          source: 'where-1',
          target: 'out-1',
          sourceHandle: 'output',
          targetHandle: 'input'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      // Table -> Where binding
      const tableToWhere = resolver.getHandleBinding('where-1', 'input-data');
      expect(tableToWhere).toBeDefined();
      expect(tableToWhere!.sourceNodeId).toBe('table-1');

      // Where -> Output binding
      const whereToOutput = resolver.getHandleBinding('out-1', 'input');
      expect(whereToOutput).toBeDefined();
      expect(whereToOutput!.sourceNodeId).toBe('where-1');

      // Output node preview should have value set
      const outputPreview = resolver.getNodePreview('out-1');
      expect(outputPreview.state).toBe('ready');
      expect(outputPreview.value).toBeDefined();
      expect(outputPreview.sql).toContain('SELECT');
    });

    it('returns no binding when table node has no table name', () => {
      const nodes: Node<LogicEditorNodeData>[] = [
        {
          id: 'table-1',
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
          } satisfies QueryTableNodeData
        },
        {
          id: 'where-1',
          type: 'query-where',
          position: basePosition,
          data: {
            kind: 'query-where',
            operator: '=',
            leftIsColumn: true,
            rightIsColumn: false
          } satisfies QueryWhereNodeData
        }
      ];

      const edges: Edge[] = [
        {
          id: 'e1',
          source: 'table-1',
          target: 'where-1',
          sourceHandle: 'output',
          targetHandle: 'input-data'
        }
      ];

      const resolver = createPreviewResolver(nodes, edges, {
        querySchema,
        queryMode: 'read'
      });

      // Table has no name => preview is 'unknown' with no value => binding should be undefined
      const binding = resolver.getHandleBinding('where-1', 'input-data');
      expect(binding).toBeUndefined();
    });
  });
});
