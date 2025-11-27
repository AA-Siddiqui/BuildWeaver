import type { Edge, Node } from 'reactflow';
import {
  buildNodePositionMap,
  createRectFromPoints,
  findEdgesIntersectingSegment,
  getNodesWithinRect
} from './graphInteractions';

describe('graphInteractions helpers', () => {
  const nodes: Node[] = [
    {
      id: 'a',
      type: 'dummy',
      position: { x: 0, y: 0 },
      data: {},
      width: 100,
      height: 60
    },
    {
      id: 'b',
      type: 'dummy',
      position: { x: 200, y: 0 },
      data: {},
      width: 100,
      height: 60
    },
    {
      id: 'c',
      type: 'dummy',
      position: { x: 400, y: 200 },
      data: {},
      width: 100,
      height: 60
    }
  ];

  const edges: Edge[] = [
    { id: 'edge-ab', source: 'a', target: 'b' },
    { id: 'edge-bc', source: 'b', target: 'c' }
  ];

  it('finds edges intersecting with a line segment', () => {
    const positions = buildNodePositionMap(nodes);
    const intersecting = findEdgesIntersectingSegment(edges, positions, {
      start: { x: 50, y: -40 },
      end: { x: 50, y: 200 }
    });

    expect(intersecting).toContain('edge-ab');
    expect(intersecting).not.toContain('edge-bc');
  });

  it('returns nodes fully contained inside a marquee rectangle', () => {
    const rect = createRectFromPoints({ x: -10, y: -10 }, { x: 350, y: 120 });
    if (!rect) {
      throw new Error('Rect should be defined');
    }
    const selected = getNodesWithinRect(nodes, rect);
    expect(selected.map((node) => node.id)).toEqual(['a', 'b']);
  });
});
