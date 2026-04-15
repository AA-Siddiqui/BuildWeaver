import type { LogicEditorEdge, LogicEditorNode, ProjectGraphSnapshot } from '../../types/api';
import { mergeGeneratedLogicIntoGraph } from './ai-logic-merge';

const createDummyNode = (id: string, x: number, y: number): LogicEditorNode => ({
  id,
  type: 'dummy',
  position: { x, y },
  data: {
    kind: 'dummy',
    label: id,
    sample: {
      type: 'integer',
      value: 1
    }
  }
});

const createEdge = (id: string, source: string, target: string): LogicEditorEdge => ({
  id,
  source,
  target
});

describe('mergeGeneratedLogicIntoGraph', () => {
  it('adds generated nodes and edges while preserving existing graph sections', () => {
    const existingGraph: ProjectGraphSnapshot = {
      nodes: [createDummyNode('existing-1', 0, 0)],
      edges: [],
      functions: [],
      databases: [{ id: 'db-1', name: 'Main DB', tables: [], relationships: [] }],
      queries: []
    };

    const generatedNodes = [createDummyNode('gen-1', 0, 0), createDummyNode('gen-2', 140, 80)];
    const generatedEdges = [createEdge('gen-edge-1', 'gen-1', 'gen-2')];

    const outcome = mergeGeneratedLogicIntoGraph(existingGraph, generatedNodes, generatedEdges);

    expect(outcome.addedNodes).toBe(2);
    expect(outcome.addedEdges).toBe(1);
    expect(outcome.remappedNodes).toBe(0);
    expect(outcome.skippedEdges).toBe(0);
    expect(outcome.graph.nodes).toHaveLength(3);
    expect(outcome.graph.edges).toHaveLength(1);
    expect(outcome.graph.databases).toEqual(existingGraph.databases);
  });

  it('remaps duplicate node ids and skips edges with unresolved endpoints', () => {
    const existingGraph: ProjectGraphSnapshot = {
      nodes: [createDummyNode('dup-node', 10, 10)],
      edges: [createEdge('dup-edge', 'dup-node', 'dup-node')],
      functions: [],
      databases: [],
      queries: []
    };

    const generatedNodes = [createDummyNode('dup-node', 0, 0), createDummyNode('fresh-node', 120, 0)];
    const generatedEdges = [
      createEdge('dup-edge', 'dup-node', 'fresh-node'),
      createEdge('missing-target', 'fresh-node', 'missing-node')
    ];

    const outcome = mergeGeneratedLogicIntoGraph(existingGraph, generatedNodes, generatedEdges);

    expect(outcome.remappedNodes).toBe(1);
    expect(outcome.addedNodes).toBe(2);
    expect(outcome.addedEdges).toBe(1);
    expect(outcome.skippedEdges).toBe(1);

    const addedNodeIds = outcome.graph.nodes.slice(1).map((node) => node.id);
    expect(addedNodeIds).toContain('fresh-node');
    expect(new Set(addedNodeIds).size).toBe(2);

    const appendedEdge = outcome.graph.edges[outcome.graph.edges.length - 1];
    expect(appendedEdge.source).not.toBe('dup-node');
    expect(appendedEdge.target).toBe('fresh-node');
  });
});
