import type { Edge, Node } from 'reactflow';
import type { LogicEditorNodeData, DummyNodeData, StringNodeData, ListNodeData } from '@buildweaver/libs';
import { createPreviewResolver } from './previewResolver';

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
          sample: { type: 'list', value: [1, 2, 3], limit: 5 }
        } satisfies DummyNodeData
      },
      {
        id: 'dummy-secondary',
        type: 'dummy',
        position: basePosition,
        data: {
          kind: 'dummy',
          label: 'Secondary list',
          sample: { type: 'list', value: [4, 5], limit: 5 }
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
          limit: 5,
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

  it('marks target handles unavailable once a connection exists', () => {
    const resolver = createPreviewResolver([], [
      { id: 'edge-1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }
    ]);

    expect(resolver.isHandleAvailable({ target: 'b', targetHandle: 'in' })).toBe(false);
    expect(resolver.isHandleAvailable({ target: 'b', targetHandle: 'other' })).toBe(true);
  });
});
