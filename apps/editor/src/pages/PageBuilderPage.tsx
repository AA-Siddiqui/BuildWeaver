import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Puck } from '@measured/puck';
import type { BuilderPreviewViewport } from './page-builder/preview-viewports';
import type { ComponentData, Content, Data } from '@measured/puck';
import '@measured/puck/puck.css';
import type { PageBuilderState, PageDocument, PageDynamicInput } from '../types/api';
import { projectGraphApi, projectPagesApi } from '../lib/api-client';
import { projectGraphQueryKey, invalidateProjectGraphCache } from '../lib/query-helpers';
import { SnapshotHistory } from '../lib/snapshotHistory';
import { processEditorShortcut } from '../lib/editorShortcuts';
import { createPageBuilderConfig } from './page-builder/builder-config';
import { clearBuilderDraft, loadBuilderDraft, persistBuilderDraft } from './page-builder/draft-storage';
import { PROPERTY_SEARCH_FIELD_KEY, resetPropertySearchState } from './page-builder/property-search';
import { buildDynamicInputPreviewMap } from './page-builder/dynamic-input-preview';
import { createPreviewSnapshotToken } from './page-builder/preview-bridge';

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

const logPageBuilderEvent = (message: string, details?: Record<string, unknown>) => {
  if (typeof console !== 'undefined') {
    console.info(`[PageBuilder] ${message}`, details ?? '');
  }
};

const BUILDER_HISTORY_LIMIT = 100;
const DEFAULT_PREVIEW_VIEWPORT: BuilderPreviewViewport = 'desktop';

const buildDefaultSection = (): ComponentData => ({
  type: 'Section',
  props: {
    id: `section-${randomId()}`,
    minHeight: '100vh',
    padding: '0px',
    paddingX: '0px',
    paddingY: '0px',
    margin: '0px',
    marginX: '0px',
    marginY: '0px',
    borderWidth: '',
    borderColor: '',
    backgroundColor: '#FFFFFF'
  }
});

export const createEmptyBuilderState = (): Data => {
  const defaultSection = buildDefaultSection();
  const state: Data = {
    root: {
      id: 'root',
      props: {},
      children: []
    },
    content: [defaultSection]
  } as Data;
  logPageBuilderEvent('Initialized default page shell', {
    defaultComponent: defaultSection.type,
    minHeight: defaultSection.props?.minHeight
  });
  return state;
};

const toPuckValue = (state?: PageBuilderState): Data => (state as Data) ?? createEmptyBuilderState();

export const derivePuckSessionKey = (page?: Pick<PageDocument, 'id' | 'updatedAt'>, fallbackPageId?: string): string => {
  const id = page?.id ?? fallbackPageId ?? 'unknown-page';
  const updatedAt = page?.updatedAt ?? 'initial';
  return `${id}:${updatedAt}`;
};

const deriveDraftStorageKey = (projectId?: string, pageId?: string): string => `${projectId ?? 'unknown-project'}:${pageId ?? 'unknown-page'}`;

const getZoneCount = (zones?: Record<string, Content> | Map<string, Content>) => {
  if (!zones) {
    return 0;
  }
  if (zones instanceof Map) {
    return zones.size;
  }
  return Object.keys(zones).length;
};

const summarizeBuilderData = (state?: Data) => ({
  contentCount: Array.isArray(state?.content) ? state.content.length : 0,
  zoneCount: getZoneCount(state?.zones as Record<string, Content> | Map<string, Content> | undefined)
});

const INTERNAL_PROP_KEYS = new Set<string>([PROPERTY_SEARCH_FIELD_KEY]);

const sanitizeComponentProps = (props: ComponentData['props']) => {
  const cleaned: ComponentData['props'] = { ...props };
  INTERNAL_PROP_KEYS.forEach((key) => {
    delete cleaned[key as keyof ComponentData['props']];
  });
  return cleaned;
};

const cloneComponent = (component: ComponentData): ComponentData => ({
  ...component,
  props: sanitizeComponentProps(component.props!)
});

const cloneContent = (items: ComponentData[] = []): ComponentData[] => items.map((item) => cloneComponent(item));

const cloneZoneEntries = (zones?: Record<string, Content> | Map<string, Content>): Record<string, ComponentData[]> | undefined => {
  if (!zones) {
    return undefined;
  }

  const normalized: Record<string, ComponentData[]> = {};
  if (zones instanceof Map) {
    zones.forEach((zoneContent, key) => {
      normalized[key] = cloneContent(Array.isArray(zoneContent) ? (zoneContent as ComponentData[]) : Array.from(zoneContent ?? []));
    });
    return normalized;
  }

  Object.entries(zones).forEach(([key, zoneContent]) => {
    normalized[key] = cloneContent(zoneContent as ComponentData[]);
  });
  return normalized;
};

export const normalizeBuilderStateForSave = (state: Data): PageBuilderState => {
  const zones = cloneZoneEntries(state.zones as Record<string, Content> | Map<string, Content> | undefined);
  const result: PageBuilderState = {
    root: {
      ...(state.root ?? { id: 'root', props: {}, children: [] })
    },
    content: cloneContent(state.content)
  };

  if (zones && Object.keys(zones).length > 0) {
    (result as Data).zones = zones;
  }

  return result;
};

const cloneBuilderSnapshot = (state: Data): Data => {
  const normalized = normalizeBuilderStateForSave(state) as Data;
  return JSON.parse(JSON.stringify(normalized)) as Data;
};

type BuilderSnapshot = {
  state: Data;
  inputs: PageDynamicInput[];
};

const cloneBuilderHistoryEntry = (snapshot: BuilderSnapshot): BuilderSnapshot => ({
  state: cloneBuilderSnapshot(snapshot.state),
  inputs: JSON.parse(JSON.stringify(snapshot.inputs)) as PageDynamicInput[]
});

export const PageBuilderPage = () => {
  const { projectId, pageId } = useParams<{ projectId: string; pageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [builderState, setBuilderState] = useState<Data>(createEmptyBuilderState());
  const [puckSessionKey, setPuckSessionKey] = useState(() => derivePuckSessionKey(undefined, pageId));
  const [dynamicInputs, setDynamicInputs] = useState<PageDynamicInput[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const sheetCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const sheetToggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [feedback, setFeedback] = useState('');
  const draftStatusRef = useRef<{ restored: boolean; savedAt?: number }>({ restored: false });
  const draftPersistHandle = useRef<number | null>(null);
  const pendingSaveRef = useRef<Promise<unknown> | null>(null);
  const builderHistoryRef = useRef(
    new SnapshotHistory<BuilderSnapshot>({
      clone: cloneBuilderHistoryEntry,
      limit: BUILDER_HISTORY_LIMIT,
      logger: (message, meta) => logPageBuilderEvent(message, meta)
    })
  );
  const draftStorageKey = useMemo(() => deriveDraftStorageKey(projectId, pageId), [projectId, pageId]);
  const getCurrentBuilderSnapshot = useCallback<() => BuilderSnapshot>(
    () => ({ state: builderState, inputs: dynamicInputs }),
    [builderState, dynamicInputs]
  );
  const updateDraftStatus = useCallback((next: Partial<{ restored: boolean; savedAt?: number }>) => {
    draftStatusRef.current = { ...draftStatusRef.current, ...next };
  }, []);

  useEffect(() => {
    resetPropertySearchState();
    return () => {
      resetPropertySearchState();
    };
  }, []);

  const pageQuery = useQuery({
    queryKey: ['project-page', projectId, pageId],
    queryFn: () => projectPagesApi.get(projectId!, pageId!),
    enabled: Boolean(projectId && pageId)
  });

  const graphQuery = useQuery({
    queryKey: projectGraphQueryKey(projectId ?? 'preview'),
    queryFn: () => projectGraphApi.get(projectId!),
    enabled: Boolean(projectId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always'
  });

  const hydrateFromPage = useCallback(
    (incomingPage: PageDocument) => {
      const hydratedState = toPuckValue(incomingPage.builderState);
      logPageBuilderEvent('Hydrating builder state from API payload', {
        pageId: incomingPage.id,
        summary: summarizeBuilderData(hydratedState)
      });
      setBuilderState(hydratedState);
      setDynamicInputs(incomingPage.dynamicInputs);
      setHasUnsavedChanges(false);
      setPuckSessionKey(derivePuckSessionKey(incomingPage, pageId));
      builderHistoryRef.current.reset(
        { state: hydratedState, inputs: incomingPage.dynamicInputs },
        { pageId: incomingPage.id, reason: 'hydrate' }
      );
    },
    [pageId]
  );

  useEffect(() => {
    const incomingPage = pageQuery.data?.page as PageDocument | undefined;
    if (!incomingPage) {
      return;
    }
    const serverUpdatedAt = incomingPage.updatedAt ? Date.parse(incomingPage.updatedAt) : 0;
    const { restored, savedAt } = draftStatusRef.current;
    if (restored && savedAt && savedAt > serverUpdatedAt) {
      logPageBuilderEvent('Draft newer than API payload — skipping hydrate', {
        pageId: incomingPage.id,
        savedAt,
        serverUpdatedAt
      });
      return;
    }
    hydrateFromPage(incomingPage);
    updateDraftStatus({ restored: false, savedAt: undefined });
  }, [hydrateFromPage, pageQuery.data?.page, updateDraftStatus]);

  useEffect(() => {
    const draft = loadBuilderDraft(draftStorageKey);
    if (draft) {
      logPageBuilderEvent('Restoring draft from local storage', {
        sessionKey: draftStorageKey,
        savedAt: draft.savedAt
      });
      const restoredState = toPuckValue(draft.state);
      setBuilderState(restoredState);
      setDynamicInputs(draft.dynamicInputs);
      setHasUnsavedChanges(true);
      updateDraftStatus({ restored: true, savedAt: draft.savedAt });
      builderHistoryRef.current.reset(
        { state: restoredState, inputs: draft.dynamicInputs },
        { sessionKey: draftStorageKey, reason: 'draft-restore' }
      );
      return;
    }
    updateDraftStatus({ restored: false, savedAt: undefined });
  }, [draftStorageKey, updateDraftStatus]);

  useEffect(() => {
    if (pageQuery.isError) {
      logPageBuilderEvent('Failed to load page builder data', {
        pageId,
        projectId,
        error: (pageQuery.error as Error)?.message ?? 'Unknown error'
      });
    }
  }, [pageQuery.error, pageQuery.isError, pageId, projectId]);

  useEffect(() => {
    if (graphQuery.isError) {
      logPageBuilderEvent('Failed to load project graph for previews', {
        pageId,
        projectId,
        error: (graphQuery.error as Error)?.message ?? 'Unknown error'
      });
    }
  }, [graphQuery.error, graphQuery.isError, pageId, projectId]);

  useEffect(() => {
    if (graphQuery.isFetching) {
      logPageBuilderEvent('Fetching project graph for live previews', {
        pageId,
        projectId,
        queryState: graphQuery.status
      });
    }
  }, [graphQuery.isFetching, graphQuery.status, pageId, projectId]);

  useEffect(() => {
    if (graphQuery.isSuccess && graphQuery.data?.graph) {
      logPageBuilderEvent('Project graph ready for live previews', {
        pageId,
        projectId,
        nodes: graphQuery.data.graph.nodes.length,
        edges: graphQuery.data.graph.edges.length,
        functions: graphQuery.data.graph.functions?.length ?? 0,
        loadedAt: graphQuery.dataUpdatedAt
      });
    }
  }, [graphQuery.data?.graph, graphQuery.dataUpdatedAt, graphQuery.isSuccess, pageId, projectId]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && draftPersistHandle.current) {
        window.clearTimeout(draftPersistHandle.current);
      }
    };
  }, []);

  const dynamicLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    dynamicInputs.forEach((input) => map.set(input.id, input.label));
    return map;
  }, [dynamicInputs]);

  const bindingOptions = useMemo(
    () => [{ label: 'Static content', value: '' }, ...dynamicInputs.map((input) => ({ label: input.label, value: input.id }))],
    [dynamicInputs]
  );

  const dynamicPreviewMap = useMemo(
    () =>
      buildDynamicInputPreviewMap({
        graph: graphQuery.data?.graph,
        pageId,
        inputs: dynamicInputs,
        logger: logPageBuilderEvent
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

  useLayoutEffect(() => {
    builderHistoryRef.current.observe(getCurrentBuilderSnapshot(), {
      pageId,
      projectId,
      ...summarizeBuilderData(builderState),
      inputs: dynamicInputs.length
    });
  }, [builderState, dynamicInputs, getCurrentBuilderSnapshot, pageId, projectId]);

  const scheduleDraftPersist = useCallback(
    (nextState: Data, nextInputs?: PageDynamicInput[]) => {
      if (typeof window === 'undefined') {
        return;
      }
      if (draftPersistHandle.current) {
        window.clearTimeout(draftPersistHandle.current);
      }
      draftPersistHandle.current = window.setTimeout(() => {
        try {
          const normalizedState = normalizeBuilderStateForSave(nextState) as PageBuilderState;
          const savedAt = persistBuilderDraft(draftStorageKey, normalizedState, nextInputs ?? dynamicInputs);
          if (savedAt) {
            updateDraftStatus({ savedAt });
            logPageBuilderEvent('Draft stored locally', {
              storageKey: draftStorageKey,
              savedAt,
              summary: summarizeBuilderData(nextState)
            });
          }
        } catch (error) {
          logPageBuilderEvent('Draft storage failed', {
            storageKey: draftStorageKey,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }, 450);
    },
    [draftStorageKey, dynamicInputs, updateDraftStatus]
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      logPageBuilderEvent('Saving page builder changes', {
        pageId,
        projectId,
        summary: summarizeBuilderData(builderState)
      });
      return projectPagesApi.update(projectId!, pageId!, {
        builderState: normalizeBuilderStateForSave(builderState) as PageBuilderState,
        dynamicInputs
      });
    },
    onSuccess: async ({ page }) => {
      logPageBuilderEvent('Save succeeded', {
        pageId: page.id,
        summary: summarizeBuilderData(page.builderState as Data)
      });
      hydrateFromPage(page);
      clearBuilderDraft(draftStorageKey);
      updateDraftStatus({ restored: false, savedAt: undefined });
      setFeedback('Saved');
      await invalidateProjectGraphCache(
        queryClient,
        projectId,
        { reason: 'page-save' },
        (message, details) => logPageBuilderEvent(message, details)
      );
      setTimeout(() => setFeedback(''), 2000);
    },
    onError: (error: unknown) => {
      logPageBuilderEvent('Save failed', {
        pageId,
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setFeedback(error instanceof Error ? error.message : 'Unable to save page');
    }
  });

  const persistBuilderChanges = useCallback(
    async ({ reason, force = false }: { reason: string; force?: boolean }) => {
      if (!projectId || !pageId) {
        return;
      }
      if (!force && !hasUnsavedChanges) {
        logPageBuilderEvent('Skipping save — no pending changes', { reason, pageId, projectId });
        return;
      }
      if (pendingSaveRef.current) {
        logPageBuilderEvent('Awaiting in-flight save before proceeding', { reason, pageId, projectId });
        return pendingSaveRef.current;
      }
      logPageBuilderEvent('Persisting builder data', {
        reason,
        pageId,
        projectId,
        summary: summarizeBuilderData(builderState)
      });
      const promise = saveMutation.mutateAsync();
      pendingSaveRef.current = promise;
      try {
        await promise;
      } finally {
        pendingSaveRef.current = null;
      }
    },
    [builderState, hasUnsavedChanges, pageId, projectId, saveMutation]
  );

  const handleBuilderChange = useCallback((value: Data) => {
    setHasUnsavedChanges(true);
    setBuilderState(value);
    logPageBuilderEvent('Builder data changed', {
      pageId,
      summary: summarizeBuilderData(value)
    });
    scheduleDraftPersist(value, dynamicInputs);
  }, [dynamicInputs, pageId, scheduleDraftPersist]);

  const handleDynamicInputChange = useCallback(
    (inputId: string, updates: Partial<PageDynamicInput>) => {
      setDynamicInputs((current) => {
        const next = current.map((input) =>
          input.id === inputId ? { ...input, ...updates, label: updates.label ?? input.label } : input
        );
        scheduleDraftPersist(builderState, next);
        return next;
      });
      setHasUnsavedChanges(true);
      logPageBuilderEvent('Dynamic input updated', { inputId, updates: Object.keys(updates) });
    },
    [builderState, scheduleDraftPersist]
  );

  const handleRemoveInput = useCallback(
    (inputId: string) => {
      setDynamicInputs((current) => {
        const next = current.filter((input) => input.id !== inputId);
        scheduleDraftPersist(builderState, next);
        return next;
      });
      setHasUnsavedChanges(true);
      logPageBuilderEvent('Dynamic input removed', { inputId });
    },
    [builderState, scheduleDraftPersist]
  );

  const handleAddDynamicInput = useCallback(() => {
    const label = window.prompt('Dynamic field label');
    if (!label) {
      return;
    }
    setDynamicInputs((current) => {
      const next = current.concat({ id: randomId(), label, dataType: 'string' });
      scheduleDraftPersist(builderState, next);
      return next;
    });
    setHasUnsavedChanges(true);
    logPageBuilderEvent('Dynamic input added', { label });
  }, [builderState, scheduleDraftPersist]);

  const handleSave = useCallback(() => {
    logPageBuilderEvent('Save triggered', { pageId, projectId, hasUnsavedChanges });
    void persistBuilderChanges({ reason: 'manual', force: true });
  }, [hasUnsavedChanges, pageId, persistBuilderChanges, projectId]);

  const handlePreviewOpen = useCallback(() => {
    if (typeof window === 'undefined' || !projectId || !pageId) {
      return;
    }
    const token = createPreviewSnapshotToken(builderState, dynamicInputs);
    if (!token) {
      setFeedback('Preview is unavailable in this browser');
      setTimeout(() => setFeedback(''), 3000);
      logPageBuilderEvent('Preview snapshot could not be stored', {
        pageId,
        projectId
      });
      return;
    }
    const targetUrl = new URL(window.location.href);
    targetUrl.pathname = `/app/${projectId}/page/${pageId}/preview`;
    targetUrl.searchParams.set('token', token);
    targetUrl.searchParams.set('viewport', DEFAULT_PREVIEW_VIEWPORT);
    const opened = window.open(targetUrl.toString(), '_blank', 'noopener,noreferrer');
    if (!opened) {
      setFeedback('Allow pop-ups to open preview');
      setTimeout(() => setFeedback(''), 3000);
      logPageBuilderEvent('Preview tab blocked by browser', {
        pageId,
        projectId
      });
      return;
    }
    logPageBuilderEvent('Opened preview tab', {
      pageId,
      projectId,
      token,
      summary: summarizeBuilderData(builderState),
      viewport: DEFAULT_PREVIEW_VIEWPORT
    });
  }, [builderState, dynamicInputs, pageId, projectId]);

  const applyBuilderSnapshot = useCallback(
    (snapshot: BuilderSnapshot, action: 'undo' | 'redo') => {
      builderHistoryRef.current.suppressNextDiff();
      setBuilderState(snapshot.state);
      setDynamicInputs(snapshot.inputs);
      setHasUnsavedChanges(true);
      scheduleDraftPersist(snapshot.state, snapshot.inputs);
      setFeedback(action === 'undo' ? 'Undid change' : 'Redid change');
      setTimeout(() => setFeedback(''), 2000);
      logPageBuilderEvent(`Builder ${action} applied`, {
        pageId,
        projectId,
        remainingUndo: builderHistoryRef.current.getUndoDepth(),
        redoDepth: builderHistoryRef.current.getRedoDepth()
      });
    },
    [pageId, projectId, scheduleDraftPersist]
  );

  const handleUndo = useCallback(() => {
    const snapshot = builderHistoryRef.current.undo(getCurrentBuilderSnapshot());
    if (!snapshot) {
      logPageBuilderEvent('Undo ignored — no history', { pageId, projectId });
      return;
    }
    applyBuilderSnapshot(snapshot, 'undo');
  }, [applyBuilderSnapshot, getCurrentBuilderSnapshot, pageId, projectId]);

  const handleRedo = useCallback(() => {
    const snapshot = builderHistoryRef.current.redo(getCurrentBuilderSnapshot());
    if (!snapshot) {
      logPageBuilderEvent('Redo ignored — no future history', { pageId, projectId });
      return;
    }
    applyBuilderSnapshot(snapshot, 'redo');
  }, [applyBuilderSnapshot, getCurrentBuilderSnapshot, pageId, projectId]);

  const handleNavigateBack = useCallback(async () => {
    if (!projectId) {
      return;
    }
    try {
      await persistBuilderChanges({ reason: 'logic-transition' });
      navigate(`/app/${projectId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save before returning to logic builder';
      logPageBuilderEvent('Navigation blocked due to save failure', { message, pageId, projectId });
      setFeedback(message);
    }
  }, [navigate, pageId, persistBuilderChanges, projectId]);

  if (!projectId || !pageId) {
    return (
      <div className="p-8 text-white">
        <p>Page not found.</p>
        <button type="button" className="mt-4 underline" onClick={() => navigate('/workspace')}>
          Go back to workspace
        </button>
      </div>
    );
  }

  const page = pageQuery.data?.page as PageDocument | undefined;

  useEffect(() => {
    if (!isSidebarOpen) {
      // restore focus to toggle when closing
      sheetToggleButtonRef.current?.focus();
      return;
    }
    // focus the close button when opening for accessibility
    sheetCloseButtonRef.current?.focus();
  }, [isSidebarOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      processEditorShortcut(event, {
        onSave: handleSave,
        onUndo: handleUndo,
        onRedo: handleRedo,
        allowInputTargets: true,
        logger: (message, meta) =>
          logPageBuilderEvent(message, {
            ...meta,
            pageId,
            projectId
          })
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRedo, handleSave, handleUndo, pageId, projectId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen]);

  return (
    <>
      <div className="flex h-screen bg-bw-ink text-white">
      {/* Modal sheet + backdrop */}
      <div
        className={`fixed inset-0 z-[60] pointer-events-none transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}
        aria-hidden={!isSidebarOpen}
      >
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <aside
          id="page-builder-sidebar"
          role="dialog"
          aria-modal="true"
          aria-labelledby="page-builder-sheet-title"
          className={`fixed left-0 top-0 h-full bg-bw-ink/90 p-4 shadow-xl transition-transform duration-200 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ width: '20rem' }}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between">
          <div>
            <p id="page-builder-sheet-title" className="text-xs uppercase tracking-[0.3em] text-bw-amber">Dynamic inputs</p>
            <p className="text-sm text-bw-platinum/70">Add inputs to expose on the Page node.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              ref={sheetCloseButtonRef}
              aria-label="Close sidebar"
              title="Close"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white"
            >
              ×
            </button>
            <button
              type="button"
              onClick={handleAddDynamicInput}
              className="rounded-lg bg-bw-sand px-3 py-1 text-sm font-semibold text-bw-ink"
            >
              Add
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {dynamicInputs.length === 0 ? (
            <p className="text-xs text-bw-platinum/60">No dynamic fields yet.</p>
          ) : (
            dynamicInputs.map((input) => (
              <div key={input.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <label className="block text-xs uppercase tracking-wide text-bw-platinum/60">
                  Label
                  <input
                    className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink px-2 py-1 text-white"
                    value={input.label}
                    onChange={(event) => handleDynamicInputChange(input.id, { label: event.target.value })}
                  />
                </label>
                <label className="mt-2 block text-xs uppercase tracking-wide text-bw-platinum/60">
                  Data type
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink px-2 py-1 text-white"
                    value={input.dataType}
                    onChange={(event) => handleDynamicInputChange(input.id, { dataType: event.target.value as PageDynamicInput['dataType'] })}
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="mt-2 text-xs text-red-300"
                  onClick={() => handleRemoveInput(input.id)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
        </aside>
      </div>
      <div className="flex flex-1 flex-col bg-white" aria-hidden={isSidebarOpen ? 'true' : 'false'}>
        <header className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 text-gray-900">
          <div className="flex items-center">
            <button
              type="button"
              ref={sheetToggleButtonRef}
              aria-label="Toggle sidebar"
              aria-controls="page-builder-sidebar"
              aria-expanded={isSidebarOpen}
              onClick={() => setIsSidebarOpen((s) => !s)}
              title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              className="rounded-lg border border-gray-300 bg-white/5 px-2 py-1 text-gray-700 mr-3 flex items-center justify-center"
            >
              <span className="text-sm">{isSidebarOpen ? '☰' : '☷'}</span>
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">UI builder</p>
              <p className="text-lg font-semibold">{page?.name ?? 'Loading page…'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-3 py-1 text-gray-700 disabled:opacity-60"
              onClick={handleNavigateBack}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : 'Back to logic'}
            </button>
            <button
              type="button"
              onClick={handlePreviewOpen}
              className="rounded-lg border border-bw-sand/40 px-3 py-1 text-gray-700 transition hover:border-bw-sand hover:text-bw-ink"
            >
              Preview
            </button>
            {feedback && <span className="text-gray-500">{feedback}</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saveMutation.isPending}
              className="rounded-xl bg-bw-sand px-4 py-2 font-semibold text-bw-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save page'}
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto bg-white">
          {pageQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading page…</p>
          ) : pageQuery.isError ? (
            <p className="text-sm text-red-500">{(pageQuery.error as Error)?.message ?? 'Unable to load page'}</p>
          ) : (
            <div className="border border-gray-200 bg-white p-6 shadow-lg">
              {/* Puck only reads the initial data prop, so key forces a remount when server data changes. */}
              <Puck key={puckSessionKey} config={builderConfig} data={builderState} onChange={handleBuilderChange} />
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
};
