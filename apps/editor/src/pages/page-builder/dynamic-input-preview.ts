import type { PageDynamicInput, ProjectGraphSnapshot } from '../../types/api';
import type { ScalarValue } from '@buildweaver/libs';
import { createPreviewResolver } from '../../components/logic/previewResolver';
import { formatScalar } from '../../components/logic/preview';
import { toFlowEdges, toFlowNodes } from '../../components/logic/graphSerialization';

export type PreviewLogHandler = (message: string, details?: Record<string, unknown>) => void;

type BuildPreviewMapParams = {
  graph?: ProjectGraphSnapshot | null;
  pageId?: string;
  inputs: PageDynamicInput[];
  logger?: PreviewLogHandler;
};

const logEvent = (logger: PreviewLogHandler | undefined, message: string, details?: Record<string, unknown>) => {
  if (typeof logger !== 'function') {
    return;
  }
  try {
    logger(message, details);
  } catch {
    // Avoid logger failures from breaking preview derivation.
  }
};

export const buildDynamicInputPreviewMap = ({ graph, pageId, inputs, logger }: BuildPreviewMapParams): Map<string, ScalarValue> => {
  if (!graph || !pageId) {
    logEvent(logger, 'Live preview evaluation skipped', {
      reason: !graph ? 'missing-graph' : 'missing-page',
      pageId: pageId ?? 'unknown',
      hasGraph: Boolean(graph)
    });
    return new Map();
  }

  const nodes = graph.nodes ?? [];
  if (!nodes.length) {
    logEvent(logger, 'Live preview evaluation skipped', {
      reason: 'no-nodes',
      pageId,
      hasGraph: true
    });
    return new Map();
  }

  try {
    const edges = graph.edges ?? [];
    const resolver = createPreviewResolver(toFlowNodes(nodes), toFlowEdges(edges), {
      functions: graph.functions ?? []
    });
    const pageNodeId = `page-${pageId}`;
    const map = new Map<string, ScalarValue>();

    inputs.forEach((input) => {
      const binding = resolver.getHandleBinding(pageNodeId, input.id);
      if (!binding || typeof binding.value === 'undefined') {
        logEvent(logger, 'Live preview unavailable', {
          pageId,
          inputId: input.id,
          targetHandle: input.id,
          hasBinding: Boolean(binding)
        });
        return;
      }
      const rawValue = binding.value as ScalarValue;
      const formatted = formatScalar(rawValue);
      map.set(input.id, rawValue);
      logEvent(logger, 'Live preview resolved', {
        pageId,
        inputId: input.id,
        sourceNodeId: binding.sourceNodeId,
        valuePreview: formatted
      });
    });

    logEvent(logger, 'Live preview map computed', {
      pageId,
      resolved: map.size,
      available: inputs.length
    });

    return map;
  } catch (error) {
    logEvent(logger, 'Live preview evaluation failed', {
      pageId,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return new Map();
  }
};
