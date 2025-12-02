import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Data } from '@measured/puck';
import { Render } from '@measured/puck';
import type { PageBuilderState, PageDocument, PageDynamicInput } from '../types/api';
import { projectGraphApi, projectPagesApi } from '../lib/api-client';
import { projectGraphQueryKey } from '../lib/query-helpers';
import { createPageBuilderConfig } from './page-builder/builder-config';
import { buildDynamicInputPreviewMap } from './page-builder/dynamic-input-preview';
import { consumePreviewSnapshot } from './page-builder/preview-bridge';
import { PREVIEW_VIEWPORTS, type BuilderPreviewViewport } from './page-builder/preview-viewports';

const logPreviewEvent = (message: string, details?: Record<string, unknown>) => {
  if (typeof console !== 'undefined') {
    console.info(`[PagePreview] ${message}`, details ?? '');
  }
};

const createEmptyBuilderState = (): Data =>
  ({
    root: {
      id: 'root',
      props: {},
      children: []
    },
    content: []
  } as unknown as Data);

const toPuckValue = (state?: PageBuilderState): Data => (state as Data) ?? createEmptyBuilderState();

const buildBindingOptions = (inputs: PageDynamicInput[]) =>
  [{ label: 'Static content', value: '' }, ...inputs.map((input) => ({ label: input.label, value: input.id }))];

const isPreviewViewport = (value: string | null): value is BuilderPreviewViewport =>
  value === 'desktop' || value === 'tablet' || value === 'mobile';

const CONTROL_HIDE_DELAY_MS = 3000;

export const PagePreviewPage = () => {
  const { projectId, pageId } = useParams<{ projectId: string; pageId: string }>();
  const [searchParams] = useSearchParams();
  const previewToken = searchParams.get('token');
  const initialViewportParam = searchParams.get('viewport');
  const [viewportMode, setViewportMode] = useState<BuilderPreviewViewport>(() =>
    isPreviewViewport(initialViewportParam) ? initialViewportParam : 'desktop'
  );
  const [renderState, setRenderState] = useState<Data | null>(null);
  const [dynamicInputs, setDynamicInputs] = useState<PageDynamicInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [snapshotResolved, setSnapshotResolved] = useState(() => !previewToken);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!previewToken || renderState) {
      setSnapshotResolved(true);
      return;
    }
    const snapshot = consumePreviewSnapshot(previewToken);
    if (snapshot) {
      setRenderState(snapshot.state);
      setDynamicInputs(snapshot.inputs);
      logPreviewEvent('Hydrated preview from snapshot', { pageId, projectId, previewToken });
    }
    setSnapshotResolved(true);
  }, [pageId, previewToken, projectId, renderState]);

  const shouldFetchPage = snapshotResolved && !renderState && Boolean(projectId && pageId);

  const pageQuery = useQuery({
    queryKey: ['project-page', projectId, pageId, 'preview'],
    queryFn: () => projectPagesApi.get(projectId!, pageId!),
    enabled: shouldFetchPage
  });

  useEffect(() => {
    if (renderState || !pageQuery.data?.page) {
      return;
    }
    const incomingPage = pageQuery.data.page as PageDocument;
    setRenderState(toPuckValue(incomingPage.builderState));
    setDynamicInputs(incomingPage.dynamicInputs);
    logPreviewEvent('Hydrated preview from API payload', { pageId: incomingPage.id, projectId });
  }, [pageId, pageQuery.data?.page, projectId, renderState]);

  useEffect(() => {
    if (!pageQuery.isError) {
      return;
    }
    const message = (pageQuery.error as Error)?.message ?? 'Unable to load page';
    setError(message);
    logPreviewEvent('Page preview failed to load via API', { message, pageId, projectId });
  }, [pageId, pageQuery.error, pageQuery.isError, projectId]);

  const graphQuery = useQuery({
    queryKey: projectGraphQueryKey(projectId ?? 'preview'),
    queryFn: () => projectGraphApi.get(projectId!),
    enabled: Boolean(projectId)
  });

  const dynamicLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    dynamicInputs.forEach((input) => map.set(input.id, input.label));
    return map;
  }, [dynamicInputs]);

  const bindingOptions = useMemo(() => buildBindingOptions(dynamicInputs), [dynamicInputs]);

  const dynamicPreviewMap = useMemo(
    () =>
      buildDynamicInputPreviewMap({
        graph: graphQuery.data?.graph,
        pageId,
        inputs: dynamicInputs,
        logger: logPreviewEvent
      }),
    [dynamicInputs, graphQuery.data?.graph, graphQuery.dataUpdatedAt, pageId]
  );

  const builderConfig = useMemo(
    () =>
      createPageBuilderConfig({
        bindingOptions,
        resolveBinding: (text?: string, bindingId?: string) => {
          if (bindingId) {
            if (dynamicPreviewMap.has(bindingId)) {
              return dynamicPreviewMap.get(bindingId) ?? '';
            }
            return `{{${dynamicLabelMap.get(bindingId) ?? bindingId}}}`;
          }
          return text || 'Text';
        }
      }),
    [bindingOptions, dynamicLabelMap, dynamicPreviewMap]
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }
    const previousMargin = document.body.style.margin;
    const previousBackground = document.body.style.backgroundColor;
    document.body.style.margin = '0';
    document.body.style.backgroundColor = '#ffffff';
    return () => {
      document.body.style.margin = previousMargin;
      document.body.style.backgroundColor = previousBackground;
    };
  }, []);

  const hideControls = useCallback(
    (reason: string) => {
      setControlsVisible((current) => {
        if (!current) {
          return current;
        }
        logPreviewEvent('Viewport controls hidden', { reason, pageId, projectId });
        return false;
      });
    },
    [pageId, projectId]
  );

  const scheduleAutoHide = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => hideControls('auto-hide'), CONTROL_HIDE_DELAY_MS);
  }, [hideControls]);

  useEffect(() => {
    if (!controlsVisible) {
      if (hideTimerRef.current && typeof window !== 'undefined') {
        window.clearTimeout(hideTimerRef.current);
      }
      return;
    }
    scheduleAutoHide();
  }, [controlsVisible, scheduleAutoHide]);

  useEffect(() => () => {
    if (hideTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(hideTimerRef.current);
    }
  }, []);

  const showControls = useCallback(
    (reason: string) => {
      setControlsVisible((current) => {
        if (current) {
          return current;
        }
        logPreviewEvent('Viewport controls shown', { reason, pageId, projectId });
        return true;
      });
      scheduleAutoHide();
    },
    [pageId, projectId, scheduleAutoHide]
  );

  const handleViewportChange = useCallback(
    (mode: BuilderPreviewViewport) => {
      if (mode === viewportMode) {
        return;
      }
      setViewportMode(mode);
      logPreviewEvent('Viewport mode changed', { pageId, projectId, from: viewportMode, to: mode });
      scheduleAutoHide();
    },
    [pageId, projectId, scheduleAutoHide, viewportMode]
  );

  const viewportPreset = PREVIEW_VIEWPORTS[viewportMode];

  const constrainedViewport = useMemo(() => {
    const width = viewportPreset.width;
    const height = viewportPreset.height;
    if (typeof window === 'undefined') {
      return { width, height };
    }
    const gutter = 48;
    return {
      width: Math.max(240, Math.min(width, window.innerWidth - gutter)),
      height: Math.max(320, Math.min(height, window.innerHeight - gutter))
    };
  }, [viewportPreset]);

  if (!projectId || !pageId) {
    return null;
  }

  if (error) {
    return <p className="p-4 text-center text-sm text-red-500">{error}</p>;
  }

  if (!renderState) {
    return <p className="p-4 text-center text-sm text-gray-500">Loading preview…</p>;
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-bw-ink/95 p-4"
      data-preview-viewport={viewportMode}
    >
      <div
        className="pointer-events-auto fixed inset-y-0 right-0 w-16"
        onMouseEnter={() => showControls('hover-zone')}
        aria-hidden="true"
        data-testid="viewport-hot-zone"
      />
      <div
        className={`preview-viewport-controls ${controlsVisible ? 'preview-viewport-controls--visible' : 'preview-viewport-controls--hidden'}`}
        data-visible={controlsVisible}
        aria-label="Viewport controls"
        onMouseEnter={() => showControls('hover-panel')}
        onMouseLeave={scheduleAutoHide}
        data-testid="viewport-controls"
      >
        {Object.entries(PREVIEW_VIEWPORTS).map(([key, preset]) => {
          const typedKey = key as BuilderPreviewViewport;
          const isActive = viewportMode === typedKey;
          return (
            <button
              key={key}
              type="button"
              className={`preview-viewport-button ${isActive ? 'preview-viewport-button--active' : ''}`}
              onClick={() => handleViewportChange(typedKey)}
              data-active={isActive}
              data-testid={`viewport-button-${typedKey}`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide">{preset.label}</span>
              <span className="text-[10px] text-white/70">{preset.width}×{preset.height}</span>
            </button>
          );
        })}
      </div>
      <div
        className="overflow-auto rounded-2xl border border-black/20 bg-white shadow-2xl"
        style={{
          width: constrainedViewport.width,
          height: constrainedViewport.height,
          maxWidth: '100%',
          maxHeight: '100%'
        }}
        data-testid="preview-canvas"
      >
        <Render config={builderConfig} data={renderState} />
      </div>
    </div>
  );
};
