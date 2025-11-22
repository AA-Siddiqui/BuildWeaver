import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Puck } from '@measured/puck';
import type { ComponentData, Config, Content, Data } from '@measured/puck';
import '@measured/puck/puck.css';
import type { PageBuilderState, PageDocument, PageDynamicInput } from '../types/api';
import { projectPagesApi } from '../lib/api-client';

const createEmptyBuilderState = (): Data =>
  ({
    root: {
      id: 'root',
      props: {},
      children: []
    },
    content: []
  } as Data);

const toPuckValue = (state?: PageBuilderState): Data => (state as Data) ?? createEmptyBuilderState();

export const derivePuckSessionKey = (page?: Pick<PageDocument, 'id' | 'updatedAt'>, fallbackPageId?: string): string => {
  const id = page?.id ?? fallbackPageId ?? 'unknown-page';
  const updatedAt = page?.updatedAt ?? 'initial';
  return `${id}:${updatedAt}`;
};

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

const logPageBuilderEvent = (message: string, details?: Record<string, unknown>) => {
  if (typeof console !== 'undefined') {
    console.info(`[PageBuilder] ${message}`, details ?? '');
  }
};

const cloneComponent = (component: ComponentData): ComponentData => ({
  ...component,
  props: { ...(component.props ?? {}) }
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

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

export const PageBuilderPage = () => {
  const { projectId, pageId } = useParams<{ projectId: string; pageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [builderState, setBuilderState] = useState<Data>(createEmptyBuilderState());
  const [puckSessionKey, setPuckSessionKey] = useState(() => derivePuckSessionKey(undefined, pageId));
  const [dynamicInputs, setDynamicInputs] = useState<PageDynamicInput[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [feedback, setFeedback] = useState('');

  const pageQuery = useQuery({
    queryKey: ['project-page', projectId, pageId],
    queryFn: () => projectPagesApi.get(projectId!, pageId!),
    enabled: Boolean(projectId && pageId)
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
    },
    [pageId]
  );

  useEffect(() => {
    if (pageQuery.data?.page) {
      hydrateFromPage(pageQuery.data.page as PageDocument);
    }
  }, [pageQuery.data?.page, hydrateFromPage]);

  useEffect(() => {
    if (pageQuery.isError) {
      logPageBuilderEvent('Failed to load page builder data', {
        pageId,
        projectId,
        error: (pageQuery.error as Error)?.message ?? 'Unknown error'
      });
    }
  }, [pageQuery.error, pageQuery.isError, pageId, projectId]);

  const dynamicLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    dynamicInputs.forEach((input) => map.set(input.id, input.label));
    return map;
  }, [dynamicInputs]);

  const bindingOptions = useMemo(
    () => [{ label: 'Static content', value: '' }, ...dynamicInputs.map((input) => ({ label: input.label, value: input.id }))],
    [dynamicInputs]
  );

  const builderConfig = useMemo(() => {
    const resolveContent = (text?: string, bindingId?: string) => {
      if (bindingId) {
        return `{{${dynamicLabelMap.get(bindingId) ?? bindingId}}}`;
      }
      return text || 'Text';
    };

    return {
      components: {
        Heading: {
          label: 'Heading',
          fields: {
            content: { type: 'text', label: 'Content' },
            size: {
              type: 'select',
              label: 'Size',
              options: [
                { label: 'XL', value: 'h1' },
                { label: 'Large', value: 'h2' },
                { label: 'Medium', value: 'h3' }
              ]
            },
            bindingId: {
              type: 'select',
              label: 'Dynamic value',
              options: bindingOptions
            }
          },
          render: ({ content, size = 'h2', bindingId }: { content?: string; size?: string; bindingId?: string }) => {
            const Tag = size as keyof JSX.IntrinsicElements;
            return <Tag className="font-semibold text-3xl">{resolveContent(content, bindingId)}</Tag>;
          }
        },
        Paragraph: {
          label: 'Paragraph',
          fields: {
            content: { type: 'textarea', label: 'Content' },
            bindingId: {
              type: 'select',
              label: 'Dynamic value',
              options: bindingOptions
            }
          },
          render: ({ content, bindingId }: { content?: string; bindingId?: string }) => (
            <p className="text-base text-gray-600">{resolveContent(content, bindingId)}</p>
          )
        },
        Button: {
          label: 'Button',
          fields: {
            label: { type: 'text', label: 'Label' },
            bindingId: {
              type: 'select',
              label: 'Dynamic value',
              options: bindingOptions
            },
            variant: {
              type: 'select',
              label: 'Variant',
              options: [
                { label: 'Primary', value: 'primary' },
                { label: 'Ghost', value: 'ghost' }
              ]
            }
          },
          render: ({ label, variant = 'primary', bindingId }: { label?: string; variant?: string; bindingId?: string }) => (
            <button
              className={`rounded-xl px-4 py-2 font-semibold ${
                variant === 'ghost' ? 'border border-gray-300 text-gray-700' : 'bg-bw-sand text-bw-ink'
              }`}
              type="button"
            >
              {resolveContent(label, bindingId)}
            </button>
          )
        }
      }
    } as Config;
  }, [bindingOptions, dynamicLabelMap]);

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
    onSuccess: ({ page }) => {
      logPageBuilderEvent('Save succeeded', {
        pageId: page.id,
        summary: summarizeBuilderData(page.builderState as Data)
      });
      hydrateFromPage(page);
      setFeedback('Saved');
      queryClient.invalidateQueries({ queryKey: ['project-graph', projectId] });
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

  const handleBuilderChange = useCallback((value: Data) => {
    setHasUnsavedChanges(true);
    setBuilderState(value);
    logPageBuilderEvent('Builder data changed', {
      pageId,
      summary: summarizeBuilderData(value)
    });
  }, [pageId]);

  const handleDynamicInputChange = useCallback(
    (inputId: string, updates: Partial<PageDynamicInput>) => {
      setDynamicInputs((current) =>
        current.map((input) => (input.id === inputId ? { ...input, ...updates, label: updates.label ?? input.label } : input))
      );
      setHasUnsavedChanges(true);
      logPageBuilderEvent('Dynamic input updated', { inputId, updates: Object.keys(updates) });
    },
    []
  );

  const handleRemoveInput = useCallback((inputId: string) => {
    setDynamicInputs((current) => current.filter((input) => input.id !== inputId));
    setHasUnsavedChanges(true);
    logPageBuilderEvent('Dynamic input removed', { inputId });
  }, []);

  const handleAddDynamicInput = useCallback(() => {
    const label = window.prompt('Dynamic field label');
    if (!label) {
      return;
    }
    setDynamicInputs((current) => current.concat({ id: randomId(), label, dataType: 'string' }));
    setHasUnsavedChanges(true);
    logPageBuilderEvent('Dynamic input added', { label });
  }, []);

  const handleSave = useCallback(() => {
    logPageBuilderEvent('Save triggered', { pageId, projectId, hasUnsavedChanges });
    saveMutation.mutate();
  }, [hasUnsavedChanges, pageId, projectId, saveMutation]);

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

  return (
    <div className="flex h-[calc(100vh-64px)] bg-bw-ink text-white">
      <aside className="w-80 border-r border-white/10 bg-bw-ink/90 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Dynamic inputs</p>
            <p className="text-sm text-bw-platinum/70">Add inputs to expose on the Page node.</p>
          </div>
          <button
            type="button"
            onClick={handleAddDynamicInput}
            className="rounded-lg bg-bw-sand px-3 py-1 text-sm font-semibold text-bw-ink"
          >
            Add
          </button>
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
      <div className="flex flex-1 flex-col bg-white">
        <header className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 text-gray-900">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">UI builder</p>
            <p className="text-lg font-semibold">{page?.name ?? 'Loading page…'}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-3 py-1 text-gray-700"
              onClick={() => navigate(`/app/${projectId}`)}
            >
              Back to logic
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
        <div className="flex-1 overflow-y-auto bg-white p-6">
          {pageQuery.isLoading ? (
            <p className="text-sm text-gray-500">Loading page…</p>
          ) : pageQuery.isError ? (
            <p className="text-sm text-red-500">{(pageQuery.error as Error)?.message ?? 'Unable to load page'}</p>
          ) : (
            <div className="mx-auto max-w-4xl rounded-3xl border border-gray-200 bg-white p-6 shadow-lg">
              {/* Puck only reads the initial data prop, so key forces a remount when server data changes. */}
              <Puck key={puckSessionKey} config={builderConfig} data={builderState} onChange={handleBuilderChange} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
