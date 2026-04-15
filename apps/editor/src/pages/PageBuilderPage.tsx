import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Puck } from '@measured/puck';
import type { BuilderPreviewViewport } from './page-builder/preview-viewports';
import type { ComponentData, Content, Data } from '@measured/puck';
import '@measured/puck/puck.css';
import type { PageBuilderState, PageDocument, PageDynamicInput, ProjectCheckpointSummary } from '../types/api';
import type { ScalarValue } from '@buildweaver/libs';
import {
  projectComponentsApi,
  projectGraphApi,
  projectPagesApi,
  projectAiApi,
  type AiAgentModeOptions
} from '../lib/api-client';
import { projectGraphQueryKey, invalidateProjectGraphCache } from '../lib/query-helpers';
import { SnapshotHistory } from '../lib/snapshotHistory';
import { processEditorShortcut } from '../lib/editorShortcuts';
import { createPageBuilderConfig } from './page-builder/builder-config';
import { clearBuilderDraft, loadBuilderDraft, persistBuilderDraft } from './page-builder/draft-storage';
import { PROPERTY_SEARCH_FIELD_KEY, resetPropertySearchState } from './page-builder/property-search';
import { buildDynamicInputPreviewMap } from './page-builder/dynamic-input-preview';
import { createPreviewSnapshotToken } from './page-builder/preview-bridge';
import { formatBindingPlaceholder, resolvePropertyPathValue } from './page-builder/dynamic-binding';
import { ListScopeBindingProvider } from './page-builder/list-scope-binding-context';
import { buildListScopeBindingLookup } from './page-builder/list-scope-registry';
import {
  projectListSlotPropertyPath,
  resolveListSlotScopedValue
} from './page-builder/list-slot-context';
import { ComponentLibraryProvider, type SaveComponentRequest } from './page-builder/component-library-context';
import { COMPONENT_ACTIONS_FIELD_KEY } from './page-builder/component-library';
import { formatScalar } from '../components/logic/preview';
import { AiCommandPalette, type PageBuilderAiSubmitOptions } from '../components/ai-command-palette';
import { ProjectCheckpointModal } from '../components/checkpoints/ProjectCheckpointModal';
import { mergeGeneratedLogicIntoGraph } from './page-builder/ai-logic-merge';

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

const summarizeScalarValue = (value?: ScalarValue) => {
  if (value === null || typeof value === 'undefined') {
    return value ?? null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return `[array:${value.length}]`;
  }
  if (typeof value === 'object') {
    return `[object:${Object.keys(value as Record<string, unknown>).length}]`;
  }
  return value;
};

const formatObjectSampleDraft = (sample?: Record<string, unknown>): string => {
  if (!sample) {
    return '';
  }
  try {
    return JSON.stringify(sample, null, 2);
  } catch {
    return '';
  }
};

const requiresObjectSample = (input: PageDynamicInput): boolean =>
  input.dataType === 'object' || (input.dataType === 'list' && input.listItemType === 'object');

const deriveListObjectSample = (
  input: PageDynamicInput,
  previewValue?: ScalarValue
): Record<string, ScalarValue> | undefined => {
  if (input.dataType !== 'list' || input.listItemType !== 'object') {
    return undefined;
  }
  if (input.objectSample) {
    return input.objectSample;
  }
  if (Array.isArray(previewValue)) {
    const firstObject = previewValue.find(
      (entry): entry is Record<string, ScalarValue> =>
        Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
    );
    if (firstObject) {
      return firstObject;
    }
  }
  return undefined;
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

const INTERNAL_PROP_KEYS = new Set<string>([PROPERTY_SEARCH_FIELD_KEY, COMPONENT_ACTIONS_FIELD_KEY]);

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
  const [objectSampleDrafts, setObjectSampleDrafts] = useState<Record<string, string>>({});
  const [objectSampleErrors, setObjectSampleErrors] = useState<Record<string, string>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const sheetCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const sheetToggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isAiPaletteOpen, setIsAiPaletteOpen] = useState(false);
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);
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

  useEffect(() => {
    const allowed = new Set(dynamicInputs.filter(requiresObjectSample).map((input) => input.id));
    setObjectSampleDrafts((current) => {
      const entries = Object.entries(current);
      const filtered = entries.filter(([key]) => allowed.has(key));
      if (filtered.length === entries.length) {
        return current;
      }
      return filtered.reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
    });
    setObjectSampleErrors((current) => {
      const entries = Object.entries(current);
      const filtered = entries.filter(([key]) => allowed.has(key));
      if (filtered.length === entries.length) {
        return current;
      }
      return filtered.reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
    });
  }, [dynamicInputs]);

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

  const componentsQuery = useQuery({
    queryKey: ['project-components', projectId],
    queryFn: () => projectComponentsApi.list(projectId!),
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
    if (componentsQuery.isError) {
      logPageBuilderEvent('Failed to load project component library', {
        pageId,
        projectId,
        error: (componentsQuery.error as Error)?.message ?? 'Unknown error'
      });
    }
  }, [componentsQuery.error, componentsQuery.isError, pageId, projectId]);

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

  const bindingOptions = useMemo(
    () => [
      { label: 'Static content', value: '' },
      ...dynamicInputs.map((input) => {
        const previewValue = dynamicPreviewMap.get(input.id);
        return {
          label: input.label,
          value: input.id,
          dataType: input.dataType,
          objectSample: input.dataType === 'object' ? input.objectSample : undefined,
          listItemType: input.dataType === 'list' ? input.listItemType : undefined,
          listObjectSample: deriveListObjectSample(input, previewValue),
          previewValue
        };
      })
    ],
    [dynamicInputs, dynamicPreviewMap]
  );

  const componentLibrary = componentsQuery.data?.components ?? [];

  const saveComponentMutation = useMutation({
    mutationFn: (request: SaveComponentRequest) => {
      if (!projectId) {
        throw new Error('Missing project id');
      }
      logPageBuilderEvent('Saving component to project library', {
        pageId,
        projectId,
        targetId: request.targetId,
        name: request.name,
        bindings: request.bindingReferences.length,
        parameters: request.bindingReferences.filter((ref) => ref.exposeAsParameter).length
      });
      return projectComponentsApi.create(projectId, {
        name: request.name,
        definition: request.definition as unknown as Record<string, unknown>,
        bindingReferences: request.bindingReferences
      });
    },
    onSuccess: async ({ component }) => {
      logPageBuilderEvent('Component saved to project library', {
        projectId,
        componentId: component.id,
        bindings: component.bindingReferences?.length ?? 0
      });
      await queryClient.invalidateQueries({ queryKey: ['project-components', projectId] });
    },
    onError: (error: unknown) => {
      logPageBuilderEvent('Component save failed', {
        projectId,
        pageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const handleSaveComponent = useCallback(
    async (request: SaveComponentRequest) => {
      await saveComponentMutation.mutateAsync(request);
    },
    [saveComponentMutation]
  );

  const aiUiMutation = useMutation({
    mutationFn: ({ prompt, options }: { prompt: string; options: AiAgentModeOptions }) => {
      if (!projectId) {
        throw new Error('Missing project id');
      }
      logPageBuilderEvent('AI UI generation requested', {
        projectId,
        pageId,
        promptLength: prompt.length,
        agentMode: options.agentMode === true
      });
      return projectAiApi.generateUi(projectId, prompt, options);
    },
    onSuccess: (result) => {
      logPageBuilderEvent('AI UI generation succeeded', {
        projectId,
        pageId,
        contentItems: result.data.content.length,
        zoneCount: Object.keys(result.data.zones ?? {}).length,
        summary: result.summary
      });

      const aiGeneratedState = result.data as Data;
      builderHistoryRef.current.observe(getCurrentBuilderSnapshot(), {
        pageId,
        projectId,
        reason: 'pre-ai-ui-generation'
      });

      setBuilderState(aiGeneratedState);
      setHasUnsavedChanges(true);
      setPuckSessionKey(derivePuckSessionKey(undefined, pageId) + ':ai-' + Date.now());
      scheduleDraftPersist(aiGeneratedState, dynamicInputs);

      setFeedback(`AI generated: ${result.summary}`);
      setTimeout(() => setFeedback(''), 4000);
      setIsAiPaletteOpen(false);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'AI UI generation failed';
      logPageBuilderEvent('AI UI generation failed', {
        projectId,
        pageId,
        error: message
      });
      setFeedback(message);
      setTimeout(() => setFeedback(''), 4000);
    }
  });

  const aiAgentMutation = useMutation({
    mutationFn: async ({ prompt, options }: { prompt: string; options: AiAgentModeOptions }) => {
      if (!projectId) {
        throw new Error('Missing project id');
      }

      logPageBuilderEvent('AI agent generation requested from page builder', {
        projectId,
        pageId,
        promptLength: prompt.length,
        agentMode: options.agentMode === true
      });

      const result = await projectAiApi.generateAgent(projectId, prompt, options);
      logPageBuilderEvent('AI agent routing resolved for page builder', {
        projectId,
        pageId,
        applyUi: result.targets.ui,
        applyLogic: result.targets.logic,
        routingReason: result.routing.reason,
        summary: result.summary
      });

      let mergeOutcome: ReturnType<typeof mergeGeneratedLogicIntoGraph> | null = null;
      let persistedGraph: Awaited<ReturnType<typeof projectGraphApi.save>>['graph'] | null = null;

      if (result.logic) {
        if (result.logic.nodes.length === 0) {
          logPageBuilderEvent('AI agent returned logic target with empty node payload', {
            projectId,
            pageId,
            summary: result.logic.summary
          });
        } else {
          const currentGraph = graphQuery.data?.graph ?? (await projectGraphApi.get(projectId)).graph;
          logPageBuilderEvent('Loaded graph snapshot for AI agent logic merge', {
            projectId,
            pageId,
            existingNodes: currentGraph.nodes.length,
            existingEdges: currentGraph.edges.length
          });

          mergeOutcome = mergeGeneratedLogicIntoGraph(currentGraph, result.logic.nodes, result.logic.edges);
          logPageBuilderEvent('Merged AI agent logic into graph snapshot', {
            projectId,
            pageId,
            addedNodes: mergeOutcome.addedNodes,
            addedEdges: mergeOutcome.addedEdges,
            remappedNodes: mergeOutcome.remappedNodes,
            skippedEdges: mergeOutcome.skippedEdges
          });

          const saveResult = await projectGraphApi.save(projectId, mergeOutcome.graph);
          persistedGraph = saveResult.graph;

          logPageBuilderEvent('Persisted AI agent logic graph updates', {
            projectId,
            pageId,
            persistedNodes: persistedGraph.nodes.length,
            persistedEdges: persistedGraph.edges.length
          });

          await invalidateProjectGraphCache(
            queryClient,
            projectId,
            { reason: 'ai-agent-logic-generation' },
            (message, details) => logPageBuilderEvent(message, details)
          );
        }
      }

      return {
        result,
        mergeOutcome,
        persistedGraph
      };
    },
    onSuccess: ({ result, mergeOutcome, persistedGraph }) => {
      if (result.ui) {
        logPageBuilderEvent('Applying AI agent UI payload to page builder state', {
          projectId,
          pageId,
          contentItems: result.ui.data.content.length,
          zoneCount: Object.keys(result.ui.data.zones ?? {}).length,
          summary: result.ui.summary
        });

        const aiGeneratedState = result.ui.data as Data;
        builderHistoryRef.current.observe(getCurrentBuilderSnapshot(), {
          pageId,
          projectId,
          reason: 'pre-ai-agent-ui-generation'
        });

        setBuilderState(aiGeneratedState);
        setHasUnsavedChanges(true);
        setPuckSessionKey(derivePuckSessionKey(undefined, pageId) + ':ai-' + Date.now());
        scheduleDraftPersist(aiGeneratedState, dynamicInputs);
      }

      if (result.logic && mergeOutcome && persistedGraph) {
        logPageBuilderEvent('AI agent logic updates applied from page builder', {
          projectId,
          pageId,
          addedNodes: mergeOutcome.addedNodes,
          addedEdges: mergeOutcome.addedEdges,
          persistedNodes: persistedGraph.nodes.length,
          persistedEdges: persistedGraph.edges.length,
          summary: result.logic.summary
        });
      }

      const appliedTargets: string[] = [];
      if (result.targets.ui) {
        appliedTargets.push('UI');
      }
      if (result.targets.logic) {
        appliedTargets.push('logic');
      }

      setFeedback(`AI updated ${appliedTargets.join(' and ')}: ${result.summary}`);
      setTimeout(() => setFeedback(''), 4000);
      setIsAiPaletteOpen(false);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'AI agent generation failed';
      logPageBuilderEvent('AI agent generation failed in page builder', {
        projectId,
        pageId,
        error: message
      });
      setFeedback(message);
      setTimeout(() => setFeedback(''), 4000);
    }
  });

  const handleAiSubmit = useCallback(
    (prompt: string, options: PageBuilderAiSubmitOptions) => {
      logPageBuilderEvent('AI prompt submitted from page builder', {
        pageId,
        projectId,
        promptLength: prompt.length,
        agentMode: options.agentMode
      });

      const requestOptions: AiAgentModeOptions = {
        agentMode: options.agentMode
      };

      if (options.agentMode) {
        aiAgentMutation.mutate({ prompt, options: requestOptions });
        return;
      }

      aiUiMutation.mutate({ prompt, options: requestOptions });
    },
    [aiAgentMutation, aiUiMutation, pageId, projectId]
  );

  const handleAiPaletteToggle = useCallback(() => {
    setIsAiPaletteOpen((prev) => {
      const next = !prev;
      logPageBuilderEvent(next ? 'AI palette opened' : 'AI palette closed', { pageId, projectId });
      return next;
    });
  }, [pageId, projectId]);

  const builderConfig = useMemo(
    () =>
      createPageBuilderConfig({
        bindingOptions,
        resolveBinding: (text?: string, bindingId?: string, propertyPath?: string[]) => {
          if (bindingId) {
            const scopedValue = resolveListSlotScopedValue(bindingId, propertyPath);
            if (typeof scopedValue !== 'undefined') {
              logPageBuilderEvent('Resolved list scope binding', {
                bindingId,
                propertyPath,
                preview: summarizeScalarValue(scopedValue)
              });
              return formatScalar(scopedValue);
            }
          }
          const normalizedPath = projectListSlotPropertyPath(bindingId, propertyPath);
          if (bindingId) {
            if (dynamicPreviewMap.has(bindingId)) {
              const resolvedValue = resolvePropertyPathValue(dynamicPreviewMap.get(bindingId), normalizedPath);
              if (typeof resolvedValue !== 'undefined') {
                return formatScalar(resolvedValue);
              }
            }
            const label = dynamicLabelMap.get(bindingId) ?? bindingId;
            return `{{${formatBindingPlaceholder(label, normalizedPath)}}}`;
          }
          return text || 'Text';
        },
        resolveBindingValue: (bindingId?: string, propertyPath?: string[]) => {
          if (!bindingId) {
            return undefined;
          }
          const scopedValue = resolveListSlotScopedValue(bindingId, propertyPath);
          if (typeof scopedValue !== 'undefined') {
            logPageBuilderEvent('Provided scoped binding value', {
              bindingId,
              propertyPath,
              preview: summarizeScalarValue(scopedValue)
            });
            return scopedValue;
          }
          const normalizedPath = projectListSlotPropertyPath(bindingId, propertyPath);
          const rawValue = dynamicPreviewMap.get(bindingId);
          return resolvePropertyPathValue(rawValue, normalizedPath);
        },
        componentLibrary
      }),
    [bindingOptions, componentLibrary, dynamicLabelMap, dynamicPreviewMap]
  );

  const componentLibraryContextValue = useMemo(
    () => ({
      builderState,
      bindingOptions,
      componentLibrary,
      isSavingComponent: saveComponentMutation.isPending,
      saveComponent: handleSaveComponent,
      log: (message: string, details?: Record<string, unknown>) => logPageBuilderEvent(message, details)
    }),
    [bindingOptions, builderState, componentLibrary, handleSaveComponent, saveComponentMutation.isPending]
  );

  const listScopeBindingLookup = useMemo(
    () => buildListScopeBindingLookup(builderState, dynamicPreviewMap),
    [builderState, dynamicPreviewMap]
  );

  useEffect(() => {
    logPageBuilderEvent('List scope binding lookup refreshed', {
      pageId,
      componentsWithScope: listScopeBindingLookup.size
    });
  }, [listScopeBindingLookup, pageId]);

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
      let shouldFlushSampleDraft = false;
      setDynamicInputs((current) => {
        const next = current.map((input) => {
          if (input.id !== inputId) {
            return input;
          }
          const nextDataType = updates.dataType ?? input.dataType;
          const nextListItemType =
            nextDataType === 'list'
              ? (updates.listItemType ?? input.listItemType ?? 'string')
              : undefined;
          const previouslyRequiredSample = requiresObjectSample(input);
          const nextInput: PageDynamicInput = {
            ...input,
            ...updates,
            label: updates.label ?? input.label,
            dataType: nextDataType,
            listItemType: nextListItemType
          };
          if (!requiresObjectSample(nextInput)) {
            nextInput.objectSample = undefined;
          }
          if (previouslyRequiredSample && !requiresObjectSample(nextInput)) {
            shouldFlushSampleDraft = true;
          }
          return nextInput;
        });
        scheduleDraftPersist(builderState, next);
        return next;
      });
      if (shouldFlushSampleDraft) {
        setObjectSampleDrafts((current) => {
          if (!(inputId in current)) {
            return current;
          }
          const next = { ...current };
          delete next[inputId];
          return next;
        });
        setObjectSampleErrors((current) => {
          if (!(inputId in current)) {
            return current;
          }
          const next = { ...current };
          delete next[inputId];
          return next;
        });
      }
      setHasUnsavedChanges(true);
      logPageBuilderEvent('Dynamic input updated', {
        inputId,
        updates: Object.keys(updates),
        nextType: updates.dataType,
        nextListItemType: updates.listItemType
      });
    },
    [builderState, scheduleDraftPersist]
  );

  const handleObjectSampleDraftChange = useCallback(
    (inputId: string, draft: string) => {
      setObjectSampleDrafts((current) => ({ ...current, [inputId]: draft }));
      if (!draft.trim()) {
        handleDynamicInputChange(inputId, { objectSample: undefined });
        setObjectSampleErrors((current) => ({ ...current, [inputId]: '' }));
        logPageBuilderEvent('Object sample cleared', { inputId });
        return;
      }
      try {
        const parsed = JSON.parse(draft);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Object sample must be a plain object');
        }
        handleDynamicInputChange(inputId, { objectSample: parsed });
        setObjectSampleErrors((current) => ({ ...current, [inputId]: '' }));
        logPageBuilderEvent('Object sample parsed', { inputId, keys: Object.keys(parsed as Record<string, unknown>) });
      } catch (error) {
        setObjectSampleErrors((current) => ({
          ...current,
          [inputId]: error instanceof Error ? error.message : 'Invalid JSON object'
        }));
        logPageBuilderEvent('Object sample parsing failed', {
          inputId,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    },
    [handleDynamicInputChange]
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

  const handleOpenCheckpointModal = useCallback(() => {
    setIsCheckpointModalOpen(true);
    logPageBuilderEvent('Checkpoint modal opened', { pageId, projectId });
  }, [pageId, projectId]);

  const handleCheckpointBeforeCreate = useCallback(async () => {
    await persistBuilderChanges({ reason: 'checkpoint-create', force: true });
    logPageBuilderEvent('Checkpoint pre-save completed', { pageId, projectId });
  }, [pageId, persistBuilderChanges, projectId]);

  const handleCheckpointCreated = useCallback(
    async (checkpoint: ProjectCheckpointSummary) => {
      setFeedback(`Checkpoint "${checkpoint.name}" saved`);
      setTimeout(() => setFeedback(''), 3000);
      logPageBuilderEvent('Checkpoint created', {
        projectId,
        pageId,
        checkpointId: checkpoint.id,
        checkpointName: checkpoint.name
      });
    },
    [pageId, projectId]
  );

  const handleCheckpointRestored = useCallback(
    async (checkpoint: ProjectCheckpointSummary) => {
      if (!projectId) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-page', projectId, pageId] }),
        queryClient.invalidateQueries({ queryKey: ['project-pages', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['project-components', projectId] }),
        queryClient.invalidateQueries({ queryKey: projectGraphQueryKey(projectId) })
      ]);

      logPageBuilderEvent('Checkpoint restored from page builder', {
        projectId,
        pageId,
        checkpointId: checkpoint.id,
        checkpointName: checkpoint.name
      });

      navigate(`/app/${projectId}`);
    },
    [navigate, pageId, projectId, queryClient]
  );

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
        onAiPalette: handleAiPaletteToggle,
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
  }, [handleAiPaletteToggle, handleRedo, handleSave, handleUndo, pageId, projectId]);

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
                    <option value="object">Object</option>
                    <option value="list">List</option>
                  </select>
                </label>
                {input.dataType === 'list' ? (
                  <label className="mt-2 block text-xs uppercase tracking-wide text-bw-platinum/60">
                    List item type
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-bw-ink px-2 py-1 text-white"
                      value={input.listItemType ?? 'string'}
                      onChange={(event) =>
                        handleDynamicInputChange(input.id, {
                          listItemType: event.target.value as PageDynamicInput['listItemType']
                        })
                      }
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="object">Object</option>
                    </select>
                    <p className="mt-1 text-[0.65rem] text-bw-platinum/70">
                      Lists wrap the selected type. For example, a list of objects can drive repeaters in the builder.
                    </p>
                  </label>
                ) : null}
                {requiresObjectSample(input) ? (
                  <label className="mt-2 block text-xs uppercase tracking-wide text-bw-platinum/60">
                    {input.dataType === 'object' ? 'Object sample' : 'List item sample'}
                    <textarea
                      className="mt-1 h-28 w-full rounded-lg border border-white/10 bg-bw-ink px-2 py-1 font-mono text-xs text-white"
                      value={objectSampleDrafts[input.id] ?? formatObjectSampleDraft(input.objectSample as Record<string, unknown> | undefined)}
                      onChange={(event) => handleObjectSampleDraftChange(input.id, event.target.value)}
                      placeholder={`{
  "title": "Headline",
  "cta": { "label": "Join" }
}`}
                    />
                    {objectSampleErrors[input.id] ? (
                      <p className="mt-1 text-[0.65rem] text-red-300">{objectSampleErrors[input.id]}</p>
                    ) : (
                      <p className="mt-1 text-[0.65rem] text-bw-platinum/70">
                        {input.dataType === 'object'
                          ? 'Provide JSON to describe available fields. Nested objects become selectable in bindings.'
                          : 'Provide JSON representing a single list item. Its fields become available when binding to each entry.'}
                      </p>
                    )}
                  </label>
                ) : null}
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
              className="rounded-lg border border-bw-amber/40 px-3 py-1 text-gray-700 transition hover:border-bw-amber hover:text-bw-ink disabled:opacity-60"
              onClick={handleAiPaletteToggle}
              disabled={aiUiMutation.isPending || aiAgentMutation.isPending}
              title="AI builder (Ctrl+K)"
            >
              {aiUiMutation.isPending || aiAgentMutation.isPending ? 'Generating…' : 'AI'}
            </button>
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
            <button
              type="button"
              onClick={handleOpenCheckpointModal}
              className="rounded-lg border border-gray-300 px-3 py-1 text-gray-700 transition hover:border-gray-500"
            >
              Checkpoint
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
              <ComponentLibraryProvider value={componentLibraryContextValue}>
                <ListScopeBindingProvider lookup={listScopeBindingLookup}>
                  <Puck key={puckSessionKey} config={builderConfig} data={builderState} onChange={handleBuilderChange} />
                </ListScopeBindingProvider>
              </ComponentLibraryProvider>
            </div>
          )}
        </div>
      </div>
      </div>
      {projectId && (
        <ProjectCheckpointModal
          projectId={projectId}
          isOpen={isCheckpointModalOpen}
          onClose={() => setIsCheckpointModalOpen(false)}
          onBeforeCreate={handleCheckpointBeforeCreate}
          onCreated={handleCheckpointCreated}
          onRestored={handleCheckpointRestored}
        />
      )}
      <AiCommandPalette
        open={isAiPaletteOpen}
        loading={aiUiMutation.isPending || aiAgentMutation.isPending}
        onClose={() => setIsAiPaletteOpen(false)}
        onSubmit={handleAiSubmit}
      />
    </>
  );
};
