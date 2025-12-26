import { FormEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
import { Handle, NodeProps, Position, useReactFlow } from 'reactflow';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageNodeData } from '@buildweaver/libs';
import { useLogicNavigation } from './LogicNavigationContext';
import { usePageRouteRegistry } from './PageRouteRegistryContext';
import { projectPagesApi } from '../../lib/api-client';
import { normalizeRouteSegment } from '../../lib/routes';
import { logicLogger } from '../../lib/logger';
import { invalidateProjectGraphCache } from '../../lib/query-helpers';

export const PageNode = ({ data, selected }: NodeProps<PageNodeData>) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const navigation = useLogicNavigation();
  const queryClient = useQueryClient();
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(data.pageName);
  const [displayRoute, setDisplayRoute] = useState(data.routeSegment ?? '');
  const [draftName, setDraftName] = useState(data.pageName);
  const [draftRoute, setDraftRoute] = useState(data.routeSegment ?? '');
  const [formError, setFormError] = useState('');
  const routeRegistry = usePageRouteRegistry();

  useEffect(() => {
    setDisplayName(data.pageName);
    setDisplayRoute(data.routeSegment ?? '');
  }, [data.pageName, data.routeSegment]);

  useEffect(() => {
    if (!isEditing) {
      setDraftName(data.pageName);
      setDraftRoute(data.routeSegment ?? '');
    }
  }, [data.pageName, data.routeSegment, isEditing]);

  const editingTitle = useMemo(() => `Edit ${data.pageName}`, [data.pageName]);

  const editMutation = useMutation({
    mutationFn: async (payload: { name: string; slug: string }) => {
      if (!projectId) {
        throw new Error('Project not found');
      }
      logicLogger.info('Updating page metadata', { projectId, pageId: data.pageId, slug: payload.slug });
      return projectPagesApi.update(projectId, data.pageId, payload);
    },
    onSuccess: ({ page }) => {
      logicLogger.info('Page metadata updated', { projectId, pageId: page.id, slug: page.slug });
      setDisplayName(page.name);
      setDisplayRoute(page.slug ?? '');
      setDraftName(page.name);
      setDraftRoute(page.slug ?? '');
      setFormError('');
      setIsEditing(false);
      setNodes((current) =>
        current.map((node) =>
          node.id === `page-${page.id}`
            ? {
                ...node,
                data: {
                  ...(node.data as PageNodeData),
                  pageName: page.name,
                  routeSegment: page.slug
                }
              }
            : node
        )
      );
      void invalidateProjectGraphCache(
        queryClient,
        projectId,
        { reason: 'page-metadata-update' },
        (message, details) => logicLogger.info(message, details)
      );
      queryClient.invalidateQueries({ queryKey: ['project-pages', projectId] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unable to update page metadata';
      setFormError(message);
      logicLogger.error('Page metadata update failed', { projectId, pageId: data.pageId, message });
    }
  });

  const handleOpenBuilder = (event: MouseEvent) => {
    event.stopPropagation();
    if (navigation) {
      navigation.openPageBuilder(data.pageId);
      return;
    }
    if (!projectId) {
      return;
    }
    navigate(`/app/${projectId}/page/${data.pageId}`);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      setFormError('Name is required');
      return;
    }
    const normalizedSlug = normalizeRouteSegment(draftRoute, trimmedName);
    if (routeRegistry && !routeRegistry.isRouteAvailable(normalizedSlug, data.pageId)) {
      const message = `Route /${normalizedSlug} already exists`;
      setFormError(message);
      logicLogger.warn('Page metadata update blocked due to duplicate route', {
        projectId,
        pageId: data.pageId,
        route: normalizedSlug
      });
      return;
    }
    setFormError('');
    try {
      await editMutation.mutateAsync({ name: trimmedName, slug: normalizedSlug });
    } catch {
      // handled via onError
    }
  };

  const handleCancel = (event: MouseEvent) => {
    event.stopPropagation();
    setIsEditing(false);
    setDraftName(displayName);
    setDraftRoute(displayRoute);
    setFormError('');
    logicLogger.info('Canceled page metadata edit', { projectId, pageId: data.pageId });
  };

  return (
    <div
      className={`relative w-64 rounded-2xl border ${selected ? 'border-bw-sand' : 'border-white/10'} bg-white/5 p-4 text-sm text-white shadow-xl backdrop-blur`}
    >
      <button
        type="button"
        className="absolute right-3 top-3 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-bw-platinum transition hover:border-bw-sand hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          setIsEditing(true);
          setDraftName(displayName);
          setDraftRoute(displayRoute);
          setFormError('');
          logicLogger.info('Opened page metadata editor', { projectId, pageId: data.pageId });
        }}
      >
        Edit
      </button>
      <button
        type="button"
        className="flex w-full flex-col items-start rounded-xl bg-white/10 px-3 py-2 text-left transition hover:bg-white/15"
        onClick={handleOpenBuilder}
      >
        <span className="text-xs uppercase tracking-wide text-bw-amber">Page</span>
        <span className="text-lg font-semibold">{displayName}</span>
        {displayRoute && <span className="text-xs text-bw-platinum/70">/{displayRoute}</span>}
      </button>

      <div className="mt-3 space-y-2">
        {data.inputs.length === 0 ? (
          <p className="text-xs text-bw-platinum/60">No dynamic fields yet</p>
        ) : (
          data.inputs.map((input: PageNodeData['inputs'][number]) => (
            <div key={input.id} className="relative rounded-lg border border-white/10 bg-bw-ink/40 px-3 py-2 text-xs">
              <Handle
                type="target"
                id={input.id}
                position={Position.Left}
                className="!left-[-6px] !h-3 !w-3 !bg-bw-platinum"
              />
              <p className="font-semibold text-white">{input.label}</p>
              {input.description && <p className="text-[10px] text-bw-platinum/70">{input.description}</p>}
            </div>
          ))
        )}
      </div>
      {isEditing && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-bw-ink/95 p-4 text-left"
          role="dialog"
          aria-label={editingTitle}
        >
          <form className="w-full space-y-3 text-sm" onSubmit={handleSubmit}>
            <p className="text-xs uppercase tracking-[0.3em] text-bw-amber">Page settings</p>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-bw-platinum/70">
              Name
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
              />
            </label>
            <label className="block text-[11px] uppercase tracking-[0.2em] text-bw-platinum/70">
              Route
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white"
                value={draftRoute}
                onChange={(event) => setDraftRoute(event.target.value)}
              />
            </label>
            {formError && <p className="text-xs text-red-300">{formError}</p>}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-1 text-xs text-bw-platinum"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-bw-sand px-4 py-1 text-xs font-semibold text-bw-ink disabled:opacity-60"
                disabled={editMutation.isPending}
              >
                {editMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
