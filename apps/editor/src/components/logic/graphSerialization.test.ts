import type { LogicEditorNodeData, QueryNodeData } from '@buildweaver/libs';
import type { Node, Edge } from 'reactflow';
import { serializeNodes, serializeEdges, toFlowNodes, toFlowEdges } from './graphSerialization';

type FlowNode = Node<LogicEditorNodeData>;

jest.mock('../../lib/logger', () => ({
  logicLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('graphSerialization', () => {
  describe('serializeNodes', () => {
    it('preserves standard node data unchanged', () => {
      const nodes: FlowNode[] = [
        {
          id: 'dummy-1',
          type: 'dummy',
          position: { x: 10, y: 20 },
          data: { kind: 'dummy', label: 'Test', sample: { type: 'integer', value: 42 } }
        }
      ];
      const result = serializeNodes(nodes);
      expect(result).toEqual([
        {
          id: 'dummy-1',
          type: 'dummy',
          position: { x: 10, y: 20 },
          data: { kind: 'dummy', label: 'Test', sample: { type: 'integer', value: 42 } }
        }
      ]);
    });

    it('strips arguments from query node data', () => {
      const queryData: QueryNodeData = {
        kind: 'query',
        queryId: 'q-1',
        queryName: 'My Query',
        mode: 'read',
        schemaId: 'db-1',
        arguments: [
          { id: 'arg-1', name: 'userId', type: 'string' },
          { id: 'arg-2', name: 'limit', type: 'number' }
        ]
      };
      const nodes: FlowNode[] = [
        { id: 'query-1', type: 'query', position: { x: 0, y: 0 }, data: queryData }
      ];

      const result = serializeNodes(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].data).toEqual({
        kind: 'query',
        queryId: 'q-1',
        queryName: 'My Query',
        mode: 'read',
        schemaId: 'db-1'
      });
      expect((result[0].data as unknown as Record<string, unknown>)).not.toHaveProperty('arguments');
    });

    it('strips arguments even when the array is empty', () => {
      const queryData: QueryNodeData = {
        kind: 'query',
        queryId: 'q-2',
        queryName: 'Empty Args Query',
        mode: 'insert',
        schemaId: 'db-1',
        arguments: []
      };
      const nodes: FlowNode[] = [
        { id: 'query-2', type: 'query', position: { x: 5, y: 5 }, data: queryData }
      ];

      const result = serializeNodes(nodes);

      expect((result[0].data as unknown as Record<string, unknown>)).not.toHaveProperty('arguments');
      expect(result[0].data).toEqual({
        kind: 'query',
        queryId: 'q-2',
        queryName: 'Empty Args Query',
        mode: 'insert',
        schemaId: 'db-1'
      });
    });

    it('handles a mix of query and non-query nodes, only stripping query arguments', () => {
      const nodes: FlowNode[] = [
        {
          id: 'dummy-1',
          type: 'dummy',
          position: { x: 0, y: 0 },
          data: { kind: 'dummy', label: 'D', sample: { type: 'boolean', value: true } }
        },
        {
          id: 'query-1',
          type: 'query',
          position: { x: 100, y: 100 },
          data: {
            kind: 'query',
            queryId: 'q-1',
            queryName: 'Q1',
            mode: 'read',
            schemaId: 'db-1',
            arguments: [{ id: 'a1', name: 'x', type: 'number' }]
          } as QueryNodeData
        },
        {
          id: 'logical-1',
          type: 'logical',
          position: { x: 200, y: 200 },
          data: { kind: 'logical', label: 'Logical block', operation: 'and', primarySample: true, secondarySample: false }
        }
      ];

      const result = serializeNodes(nodes);

      expect(result).toHaveLength(3);
      // Dummy unchanged
      expect(result[0].data).toHaveProperty('sample');
      // Query has arguments stripped
      expect((result[1].data as unknown as Record<string, unknown>)).not.toHaveProperty('arguments');
      expect(result[1].data).toHaveProperty('queryId', 'q-1');
      // Logical unchanged
      expect(result[2].data).toHaveProperty('operation', 'and');
    });

    it('defaults type to dummy when node type is undefined', () => {
      const nodes: FlowNode[] = [
        {
          id: 'mystery-1',
          type: undefined,
          position: { x: 0, y: 0 },
          data: { kind: 'dummy', label: 'Mystery', sample: { type: 'string', value: 'hi' } }
        }
      ];

      const result = serializeNodes(nodes);
      expect(result[0].type).toBe('dummy');
    });
  });

  describe('serializeEdges', () => {
    it('converts null handles to undefined', () => {
      const edges: Edge[] = [
        {
          id: 'e-1',
          source: 'node-a',
          target: 'node-b',
          sourceHandle: null,
          targetHandle: null
        }
      ];

      const result = serializeEdges(edges);

      expect(result[0].sourceHandle).toBeUndefined();
      expect(result[0].targetHandle).toBeUndefined();
    });

    it('preserves handle values when present', () => {
      const edges: Edge[] = [
        { id: 'e-1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }
      ];

      const result = serializeEdges(edges);
      expect(result[0].sourceHandle).toBe('out');
      expect(result[0].targetHandle).toBe('in');
    });
  });

  describe('toFlowNodes', () => {
    it('converts LogicEditorNode to FlowNode', () => {
      const nodes = [
        {
          id: 'dummy-1',
          type: 'dummy' as const,
          position: { x: 1, y: 2 },
          data: { kind: 'dummy' as const, label: 'D', sample: { type: 'integer' as const, value: 0 } }
        }
      ];
      const flow = toFlowNodes(nodes);
      expect(flow[0].id).toBe('dummy-1');
      expect(flow[0].data.kind).toBe('dummy');
    });
  });

  describe('toFlowEdges', () => {
    it('converts LogicEditorEdge to FlowEdge', () => {
      const edges = [
        { id: 'e-1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }
      ];
      const flow = toFlowEdges(edges);
      expect(flow[0].id).toBe('e-1');
      expect(flow[0].source).toBe('a');
    });
  });
});
