import type { PageDocument, LogicEditorNodeData, PageNodeData } from '../types/api';
import type { Edge, Node } from 'reactflow';
import { createPageNode, serializeEdges, serializeNodes } from './ProjectLogicPage';

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
        data: { kind: 'dummy', label: 'Dummy', value: 42 },
        dragging: true
      }
    ];
    const serializedNodes = serializeNodes(rawNodes);

    expect(serializedNodes).toEqual([
      { id: 'dummy-1', type: 'dummy', position: { x: 0, y: 0 }, data: { kind: 'dummy', label: 'Dummy', value: 42 } }
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
});
