import type { PageDynamicInput, ProjectGraphSnapshot } from '../../types/api';
import { buildDynamicInputPreviewMap } from './dynamic-input-preview';

describe('buildDynamicInputPreviewMap', () => {
  const pageId = 'page-1';
  const inputs: PageDynamicInput[] = [
    { id: 'input-1', label: 'Hero title', dataType: 'string' }
  ];

  const graph: ProjectGraphSnapshot = {
    nodes: [
      {
        id: 'dummy-1',
        type: 'dummy',
        position: { x: 0, y: 0 },
        data: {
          kind: 'dummy',
          label: 'Sample text',
          sample: { type: 'string', value: 'Resolved copy' }
        }
      },
      {
        id: `page-${pageId}`,
        type: 'page',
        position: { x: 100, y: 0 },
        data: {
          kind: 'page',
          pageId,
          pageName: 'Landing',
          routeSegment: 'landing',
          inputs
        }
      }
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'dummy-1',
        target: `page-${pageId}`,
        sourceHandle: 'dummy-output',
        targetHandle: 'input-1'
      }
    ],
    functions: []
  };

  it('produces live previews when bindings provide scalar values', () => {
    const logger = jest.fn();
    const map = buildDynamicInputPreviewMap({ graph, inputs, pageId, logger });

    expect(map.get('input-1')).toBe('Resolved copy');
    expect(logger).toHaveBeenCalledWith('Live preview resolved', expect.objectContaining({ inputId: 'input-1' }));
    expect(logger).toHaveBeenCalledWith(
      'Live preview map computed',
      expect.objectContaining({ resolved: 1, available: inputs.length })
    );
  });

  it('logs missing previews when bindings are absent', () => {
    const logger = jest.fn();
    const map = buildDynamicInputPreviewMap({ graph: { ...graph, edges: [] }, inputs, pageId, logger });

    expect(map.size).toBe(0);
    expect(logger).toHaveBeenCalledWith(
      'Live preview unavailable',
      expect.objectContaining({ inputId: 'input-1', hasBinding: false })
    );
  });

  it('logs and skips when graph data is unavailable', () => {
    const logger = jest.fn();
    const map = buildDynamicInputPreviewMap({ graph: undefined, inputs, pageId, logger });

    expect(map.size).toBe(0);
    expect(logger).toHaveBeenCalledWith(
      'Live preview evaluation skipped',
      expect.objectContaining({ reason: 'missing-graph', pageId })
    );
  });
});
