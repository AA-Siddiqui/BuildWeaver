import type { PageDocument, LogicEditorNodeData, PageNodeData } from '../types/api';
import type { Edge, Node } from 'reactflow';
import { createPageNode, serializeEdges, serializeNodes, isTargetHandleFree, collectPageRoutes } from './ProjectLogicPage';

describe('ProjectLogicPage helpers', () => {
  it('creates page nodes with derived id and metadata', () => {
    const page = {
      id: 'page-123',
      projectId: 'proj',
      name: 'Docs',
      slug: 'docs',
      builderState: {},
      dynamicInputs: [{ id: 'input-1', label: 'Title', dataType: 'string' }],
      createdAt: '',
      updatedAt: ''
    } satisfies PageDocument;

    const node = createPageNode(page, { x: 10, y: 20 });
    expect(node.id).toBe(`page-${page.id}`);
    expect((node.data as PageNodeData).inputs).toHaveLength(1);
    expect(node.position).toEqual({ x: 10, y: 20 });
  });

  it('serializes nodes and edges by keeping portable fields only', () => {
    const rawNodes: Node<LogicEditorNodeData>[] = [
      {
        id: 'dummy-1',
        type: 'dummy',
        position: { x: 0, y: 0 },
        data: { kind: 'dummy', label: 'Dummy', sample: { type: 'integer', value: 42 } },
        dragging: true
      }
    ];
    const serializedNodes = serializeNodes(rawNodes);

    expect(serializedNodes).toEqual([
      {
        id: 'dummy-1',
        type: 'dummy',
        position: { x: 0, y: 0 },
        data: { kind: 'dummy', label: 'Dummy', sample: { type: 'integer', value: 42 } }
      }
    ]);

    const rawEdges: Edge[] = [
      {
        id: 'edge-1',
        source: 'dummy-1',
        target: 'page-1',
        sourceHandle: 'out',
        targetHandle: 'input',
        animated: true
      }
    ];
    const serializedEdges = serializeEdges(rawEdges);

    expect(serializedEdges).toEqual([
      { id: 'edge-1', source: 'dummy-1', target: 'page-1', sourceHandle: 'out', targetHandle: 'input' }
    ]);
  });

  it('detects when a target handle is already taken', () => {
    const edges: Edge[] = [
      {
        id: 'edge-1',
        source: 'dummy-1',
        target: 'page-1',
        sourceHandle: 'out',
        targetHandle: 'input'
      }
    ];

    expect(isTargetHandleFree(edges, { target: 'page-1', targetHandle: 'input' })).toBe(false);
    expect(isTargetHandleFree(edges, { target: 'page-1', targetHandle: 'other' })).toBe(true);
  });

  it('collects normalized page routes from nodes and server documents', () => {
    const remotePages = [
      {
        id: 'remote-1',
        projectId: 'proj',
        name: 'Landing',
        slug: 'Landing',
        builderState: {},
        dynamicInputs: [],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'remote-2',
        projectId: 'proj',
        name: 'Docs',
        slug: '',
        builderState: {},
        dynamicInputs: [],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'remote-3',
        projectId: 'proj',
        name: 'Pricing',
        slug: 'pricing',
        builderState: {},
        dynamicInputs: [],
        createdAt: '',
        updatedAt: ''
      }
    ] satisfies PageDocument[];

    const nodes = [
      {
        id: 'page-local-1',
        type: 'page',
        position: { x: 0, y: 0 },
        data: {
          kind: 'page',
          pageId: 'page-local-1',
          pageName: 'Pricing',
          routeSegment: 'Pricing ',
          inputs: []
        }
      },
      {
        id: 'page-local-2',
        type: 'page',
        position: { x: 0, y: 0 },
        data: {
          kind: 'page',
          pageId: 'page-local-2',
          pageName: 'Experiments',
          routeSegment: 'experiments/v1',
          inputs: []
        }
      }
    ] satisfies Node<LogicEditorNodeData>[];

    const summary = collectPageRoutes(nodes, remotePages);
    expect(summary.routes).toEqual(['docs', 'experiments/v1', 'landing', 'pricing']);
    expect(summary.ownership.pricing).toEqual(['page-local-1', 'remote-3']);
  });
});
