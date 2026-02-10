import type { FlowEdge, FlowNode } from '../components/logic/graphSerialization';
import type { DatabaseSchema, LogicEditorNodeData, UserDefinedFunction } from '../types/api';
import { cloneGraphSnapshot, hashGraphSnapshot } from './graphSnapshot';

describe('graphSnapshot utilities', () => {
  const baseNode: FlowNode = {
    id: 'node-1',
    position: { x: 0, y: 0 },
    type: 'default',
    data: {
      kind: 'dummy',
      label: 'Node 1',
      sample: { type: 'integer', value: 1 }
    } as LogicEditorNodeData
  };

  const baseEdge: FlowEdge = {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    type: 'severable'
  };

  const baseFunction: UserDefinedFunction = {
    id: 'fn-1',
    name: 'Fn',
    description: 'desc',
    nodes: [],
    edges: [],
    arguments: [],
    returnsValue: false
  };

  const baseDatabase: DatabaseSchema = {
    id: 'db-1',
    name: 'Main',
    tables: [],
    relationships: []
  };

  it('removes transient fields when hashing', () => {
    const baseHash = hashGraphSnapshot({ nodes: [baseNode], edges: [baseEdge], functions: [baseFunction], databases: [baseDatabase], queries: [] });
    const snapshotWithSelection = hashGraphSnapshot({
      nodes: [{ ...baseNode, selected: true, dragging: true }],
      edges: [{ ...baseEdge, selected: true }],
      functions: [baseFunction],
      databases: [baseDatabase],
      queries: []
    });

    expect(snapshotWithSelection).toBe(baseHash);
  });

  it('produces deep clones without shared references', () => {
    const cloned = cloneGraphSnapshot({ nodes: [baseNode], edges: [baseEdge], functions: [baseFunction], databases: [baseDatabase], queries: [] });
    expect(cloned).not.toBe(baseNode);
    expect(cloned.nodes[0]).not.toBe(baseNode);
    expect(cloned.edges[0]).not.toBe(baseEdge);
    expect(cloned.functions[0]).not.toBe(baseFunction);
    expect(cloned.databases[0]).not.toBe(baseDatabase);
  });
});
