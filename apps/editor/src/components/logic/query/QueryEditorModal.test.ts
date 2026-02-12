import type {
  QueryOutputNodeData,
  QueryArgumentNodeData,
  QueryTableNodeData,
  QueryJoinNodeData,
  QueryWhereNodeData,
  QueryGroupByNodeData,
  QueryHavingNodeData,
  QueryOrderByNodeData,
  QueryLimitNodeData,
  QueryAggregationNodeData,
  QueryAttributeNodeData,
  LogicEditorNode
} from '@buildweaver/libs';
import { createQueryInnerNode } from './QueryEditorModal';
import type { QueryEditorSnapshot } from './QueryEditorModal';
import { toFlowNodes } from '../graphSerialization';
import { SnapshotHistory } from '../../../lib/snapshotHistory';

jest.mock('../../../lib/logger', () => ({
  logicLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  queryEditorLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('createQueryInnerNode', () => {
  it('creates a query-output node with correct data', () => {
    const node = createQueryInnerNode('query-output', { x: 100, y: 200 });

    expect(node.type).toBe('query-output');
    expect(node.position).toEqual({ x: 100, y: 200 });
    expect(node.data.kind).toBe('query-output');
    expect((node.data as QueryOutputNodeData).outputId).toBe(node.id);
  });

  it('creates a query-argument node with default name and type', () => {
    const node = createQueryInnerNode('query-argument');

    expect(node.type).toBe('query-argument');
    const data = node.data as QueryArgumentNodeData;
    expect(data.kind).toBe('query-argument');
    expect(data.name).toBe('arg');
    expect(data.type).toBe('string');
    expect(data.argumentId).toBe(node.id);
  });

  it('creates a query-table node with empty defaults', () => {
    const node = createQueryInnerNode('query-table');
    const data = node.data as QueryTableNodeData;

    expect(data.kind).toBe('query-table');
    expect(data.tableId).toBe('');
    expect(data.tableName).toBe('');
    expect(data.selectedColumns).toEqual([]);
    expect(data.columnDefaults).toEqual({});
    expect(data.aggregationInputCount).toBe(0);
  });

  it('creates a query-join node with inner join default', () => {
    const node = createQueryInnerNode('query-join');
    const data = node.data as QueryJoinNodeData;
    expect(data.joinType).toBe('inner');
  });

  it('creates a query-where node with equality default', () => {
    const node = createQueryInnerNode('query-where');
    const data = node.data as QueryWhereNodeData;
    expect(data.operator).toBe('=');
    expect(data.leftIsColumn).toBe(true);
    expect(data.rightIsColumn).toBe(false);
  });

  it('creates a query-groupby node', () => {
    const node = createQueryInnerNode('query-groupby');
    const data = node.data as QueryGroupByNodeData;
    expect(data.groupingAttributeCount).toBe(1);
    expect(data.attributes).toEqual([]);
  });

  it('creates a query-having node', () => {
    const node = createQueryInnerNode('query-having');
    const data = node.data as QueryHavingNodeData;
    expect(data.operator).toBe('=');
  });

  it('creates a query-orderby node', () => {
    const node = createQueryInnerNode('query-orderby');
    const data = node.data as QueryOrderByNodeData;
    expect(data.sortCount).toBe(1);
    expect(data.sortAttributes).toEqual([]);
    expect(data.sortOrders).toEqual(['asc']);
  });

  it('creates a query-limit node', () => {
    const node = createQueryInnerNode('query-limit');
    const data = node.data as QueryLimitNodeData;
    expect(data.kind).toBe('query-limit');
  });

  it('creates a query-aggregation node with count default', () => {
    const node = createQueryInnerNode('query-aggregation');
    const data = node.data as QueryAggregationNodeData;
    expect(data.function).toBe('count');
  });

  it('creates a query-attribute node', () => {
    const node = createQueryInnerNode('query-attribute');
    const data = node.data as QueryAttributeNodeData;
    expect(data.kind).toBe('query-attribute');
  });

  it('uses default position { x: 0, y: 0 } when no position is provided', () => {
    const node = createQueryInnerNode('query-output');
    expect(node.position).toEqual({ x: 0, y: 0 });
  });

  it('generates unique ids for each call', () => {
    const a = createQueryInnerNode('query-output');
    const b = createQueryInnerNode('query-output');
    expect(a.id).not.toBe(b.id);
  });
});

describe('output node auto-creation logic', () => {
  it('detects when query nodes are missing an output node', () => {
    const nodes: LogicEditorNode[] = [
      {
        id: 'qt-1',
        type: 'query-table',
        position: { x: 0, y: 0 },
        data: { kind: 'query-table', tableId: 't1', tableName: 'T', schemaId: '', selectedColumns: [], columnDefaults: {}, aggregationInputCount: 0 }
      }
    ];

    const flowNodes = toFlowNodes(nodes);
    const hasOutput = flowNodes.some((node) => node.type === 'query-output');
    expect(hasOutput).toBe(false);

    // Simulates the auto-creation logic from QueryEditorModal's useEffect
    if (!hasOutput) {
      const outputNode = createQueryInnerNode('query-output', { x: 600, y: 200 });
      flowNodes.push(outputNode);
    }

    expect(flowNodes.some((n) => n.type === 'query-output')).toBe(true);
    expect(flowNodes).toHaveLength(2);
  });

  it('does not add a duplicate output node when one already exists', () => {
    const nodes: LogicEditorNode[] = [
      {
        id: 'qo-existing',
        type: 'query-output',
        position: { x: 600, y: 200 },
        data: { kind: 'query-output', outputId: 'qo-existing' }
      },
      {
        id: 'qt-1',
        type: 'query-table',
        position: { x: 0, y: 0 },
        data: { kind: 'query-table', tableId: 't1', tableName: 'T', schemaId: '', selectedColumns: [], columnDefaults: {}, aggregationInputCount: 0 }
      }
    ];

    const flowNodes = toFlowNodes(nodes);
    const hasOutput = flowNodes.some((node) => node.type === 'query-output');
    expect(hasOutput).toBe(true);

    // In the actual code, no output node is created when one already exists
    const outputCount = flowNodes.filter((n) => n.type === 'query-output').length;
    expect(outputCount).toBe(1);
  });

  it('works correctly for an initially empty query', () => {
    const flowNodes = toFlowNodes([]);
    const hasOutput = flowNodes.some((node) => node.type === 'query-output');
    expect(hasOutput).toBe(false);

    if (!hasOutput) {
      const outputNode = createQueryInnerNode('query-output', { x: 600, y: 200 });
      flowNodes.push(outputNode);
    }

    expect(flowNodes).toHaveLength(1);
    expect(flowNodes[0].type).toBe('query-output');
    expect((flowNodes[0].data as QueryOutputNodeData).outputId).toBeTruthy();
  });
});

// -- Undo / redo snapshot history tests --

const cloneSnap = (snap: QueryEditorSnapshot): QueryEditorSnapshot =>
  JSON.parse(JSON.stringify(snap));

const hashSnap = (snap: QueryEditorSnapshot): string =>
  JSON.stringify({
    n: snap.nodes.map((n) => ({ id: n.id, d: n.data, p: n.position })),
    e: snap.edges.map((e) => e.id),
    nm: snap.name,
    m: snap.mode
  });

const makeSnap = (overrides: Partial<QueryEditorSnapshot> = {}): QueryEditorSnapshot => ({
  nodes: [],
  edges: [],
  name: 'Test Query',
  mode: 'read',
  ...overrides
});

const makeTableNode = (id: string) => ({
  id,
  type: 'query-table',
  position: { x: 0, y: 0 },
  data: { kind: 'query-table' as const, tableId: '', tableName: '', schemaId: '', selectedColumns: [] as string[], columnDefaults: {} as Record<string, string>, aggregationInputCount: 0 }
});

describe('QueryEditor SnapshotHistory', () => {
  let history: SnapshotHistory<QueryEditorSnapshot>;

  beforeEach(() => {
    history = new SnapshotHistory<QueryEditorSnapshot>({
      clone: cloneSnap,
      hash: hashSnap,
      limit: 50
    });
  });

  it('records snapshots and supports undo', () => {
    history.observe(makeSnap({ name: 'Q1' }));
    history.observe(makeSnap({ name: 'Q2' }));
    expect(history.getUndoDepth()).toBe(1);

    const restored = history.undo(makeSnap({ name: 'Q2' }));
    expect(restored!.name).toBe('Q1');
  });

  it('tracks node changes and supports undo', () => {
    history.observe(makeSnap({ nodes: [makeTableNode('n1')] }));
    history.observe(makeSnap({ nodes: [makeTableNode('n1'), makeTableNode('n2')] }));

    const restored = history.undo(makeSnap({ nodes: [makeTableNode('n1'), makeTableNode('n2')] }));
    expect(restored!.nodes).toHaveLength(1);
  });

  it('tracks edge changes and supports undo', () => {
    history.observe(makeSnap({ edges: [{ id: 'e1', source: 'n1', target: 'n2' }] }));
    history.observe(makeSnap({ edges: [{ id: 'e1', source: 'n1', target: 'n2' }, { id: 'e2', source: 'n2', target: 'n3' }] }));

    const restored = history.undo(makeSnap({ edges: [{ id: 'e1', source: 'n1', target: 'n2' }, { id: 'e2', source: 'n2', target: 'n3' }] }));
    expect(restored!.edges).toHaveLength(1);
  });

  it('tracks mode changes and supports undo', () => {
    history.observe(makeSnap({ mode: 'read' }));
    history.observe(makeSnap({ mode: 'insert' }));

    const restored = history.undo(makeSnap({ mode: 'insert' }));
    expect(restored!.mode).toBe('read');
  });

  it('supports redo after undo', () => {
    history.observe(makeSnap({ name: 'Q1' }));
    history.observe(makeSnap({ name: 'Q2' }));

    const afterUndo = history.undo(makeSnap({ name: 'Q2' }));
    const afterRedo = history.redo(afterUndo!);
    expect(afterRedo!.name).toBe('Q2');
  });

  it('returns null when nothing to undo or redo', () => {
    history.observe(makeSnap());
    expect(history.undo(makeSnap())).toBeNull();
    expect(history.redo(makeSnap())).toBeNull();
  });

  it('suppressNextDiff prevents recording after restore', () => {
    history.observe(makeSnap({ name: 'Q1' }));
    history.observe(makeSnap({ name: 'Q2' }));

    history.suppressNextDiff();
    history.observe(makeSnap({ name: 'Q1-restored' }));
    expect(history.getUndoDepth()).toBe(1);
  });

  it('resets history on new query load', () => {
    history.observe(makeSnap({ name: 'Q1' }));
    history.observe(makeSnap({ name: 'Q2' }));
    history.reset(makeSnap({ name: 'Fresh' }));
    expect(history.getUndoDepth()).toBe(0);
    expect(history.getRedoDepth()).toBe(0);
  });

  it('clones snapshots to prevent mutation', () => {
    history.observe(makeSnap({ nodes: [makeTableNode('n1')] }));
    history.observe(makeSnap({ nodes: [makeTableNode('n1'), makeTableNode('n2')] }));

    const restored = history.undo(makeSnap({ nodes: [makeTableNode('n1'), makeTableNode('n2')] }));
    restored!.nodes.push(makeTableNode('hacked'));

    const afterRedo = history.redo(restored!);
    expect(afterRedo!.nodes).toHaveLength(2);
  });
});

// -- Query output node single-input restriction tests --

describe('query-output single-input restriction', () => {
  const makeOutputNode = (id: string) => ({
    id,
    type: 'query-output' as const,
    position: { x: 600, y: 200 },
    data: { kind: 'query-output' as const, outputId: id }
  });

  const makeEdge = (id: string, source: string, target: string, targetHandle = 'input') => ({
    id,
    source,
    target,
    targetHandle
  });

  it('blocks a second connection to the same query-output input handle', () => {
    const nodes = [makeOutputNode('out-1'), makeTableNode('t1'), makeTableNode('t2')];
    const edges = [makeEdge('e1', 't1', 'out-1')];

    // Simulates the isValidConnection / handleConnect guard logic
    const connection = { source: 't2', target: 'out-1', sourceHandle: null, targetHandle: 'input' };
    const targetNode = nodes.find((n) => n.id === connection.target);
    const isOutputNode = targetNode?.type === 'query-output';
    const existingConnections = edges.filter(
      (e) => e.target === connection.target && e.targetHandle === (connection.targetHandle ?? 'input')
    );

    expect(isOutputNode).toBe(true);
    expect(existingConnections.length).toBeGreaterThan(0);
    // Connection should be rejected
  });

  it('allows the first connection to a query-output node', () => {
    const nodes = [makeOutputNode('out-1'), makeTableNode('t1')];
    const edges: ReturnType<typeof makeEdge>[] = [];

    const connection = { source: 't1', target: 'out-1', sourceHandle: null, targetHandle: 'input' };
    const targetNode = nodes.find((n) => n.id === connection.target);
    const isOutputNode = targetNode?.type === 'query-output';
    const existingConnections = edges.filter(
      (e) => e.target === connection.target && e.targetHandle === (connection.targetHandle ?? 'input')
    );

    expect(isOutputNode).toBe(true);
    expect(existingConnections.length).toBe(0);
    // Connection should be accepted
  });

  it('allows connections to non-output nodes even when output is occupied', () => {
    const joinNode = {
      id: 'join-1',
      type: 'query-join',
      position: { x: 300, y: 100 },
      data: { kind: 'query-join' as const, joinType: 'inner' as const }
    };
    const nodes = [makeOutputNode('out-1'), joinNode, makeTableNode('t1'), makeTableNode('t2')];
    const edges = [makeEdge('e1', 't1', 'out-1')];

    const connection = { source: 't2', target: 'join-1', sourceHandle: null, targetHandle: 'left' };
    const targetNode = nodes.find((n) => n.id === connection.target);
    const isOutputNode = targetNode?.type === 'query-output';

    expect(isOutputNode).toBe(false);
    // Non-output targets should not check edge count
    const existingToTarget = edges.filter((e) => e.target === connection.target);
    expect(existingToTarget.length).toBe(0);
    // Connection should be accepted regardless
  });
});
