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
import { toFlowNodes } from '../graphSerialization';

jest.mock('../../../lib/logger', () => ({
  logicLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
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
