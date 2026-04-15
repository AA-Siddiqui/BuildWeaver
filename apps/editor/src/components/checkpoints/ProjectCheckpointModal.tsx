import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectCheckpointsApi } from '../../lib/api-client';
import { checkpointLogger } from '../../lib/logger';
import type { ProjectCheckpointSummary } from '../../types/api';

type ModalView = 'menu' | 'create' | 'restore';

type RestorePayload = {
  checkpointId: string;
  checkpointName: string;
};

interface ProjectCheckpointModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onBeforeCreate?: () => Promise<void> | void;
  onCreated?: (checkpoint: ProjectCheckpointSummary) => Promise<void> | void;
  onRestored?: (checkpoint: ProjectCheckpointSummary) => Promise<void> | void;
}

const projectCheckpointQueryKey = (projectId: string) => ['project-checkpoints', projectId] as const;

const formatTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

export const ProjectCheckpointModal = ({
  projectId,
  isOpen,
  onClose,
  onBeforeCreate,
  onCreated,
  onRestored
}: ProjectCheckpointModalProps) => {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ModalView>('menu');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setView('menu');
    setName('');
    setDescription('');
    setFeedback('');
    checkpointLogger.info('Checkpoint modal opened', { projectId });
  }, [isOpen, projectId]);

  const checkpointsQuery = useQuery({
    queryKey: projectCheckpointQueryKey(projectId),
    queryFn: () => projectCheckpointsApi.list(projectId),
    enabled: isOpen && view === 'restore',
    staleTime: 30 * 1000
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      if (onBeforeCreate) {
        checkpointLogger.debug('Running pre-checkpoint create hook', { projectId });
        await onBeforeCreate();
      }
      return projectCheckpointsApi.create(projectId, payload);
    },
    onSuccess: async ({ checkpoint }) => {
      checkpointLogger.info('Checkpoint created from modal', {
        projectId,
        checkpointId: checkpoint.id,
        checkpointName: checkpoint.name
      });
      await queryClient.invalidateQueries({ queryKey: projectCheckpointQueryKey(projectId) });
      if (onCreated) {
        await onCreated(checkpoint);
      }
      setFeedback(`Created checkpoint "${checkpoint.name}"`);
      setView('menu');
      setName('');
      setDescription('');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to create checkpoint';
      checkpointLogger.error('Checkpoint creation failed', { projectId, message });
      setFeedback(message);
    }
  });

  const restoreMutation = useMutation({
    mutationFn: (payload: RestorePayload) => projectCheckpointsApi.restore(projectId, payload.checkpointId),
    onSuccess: async ({ checkpoint }, payload) => {
      checkpointLogger.warn('Checkpoint restored from modal', {
        projectId,
        checkpointId: checkpoint.id,
        checkpointName: payload.checkpointName
      });
      await queryClient.invalidateQueries({ queryKey: projectCheckpointQueryKey(projectId) });
      if (onRestored) {
        await onRestored(checkpoint);
      }
      onClose();
    },
    onError: (error: unknown, payload) => {
      const message = error instanceof Error ? error.message : 'Unable to restore checkpoint';
      checkpointLogger.error('Checkpoint restore failed', {
        projectId,
        checkpointId: payload.checkpointId,
        checkpointName: payload.checkpointName,
        message
      });
      setFeedback(message);
    }
  });

  const hasRestoreItems = (checkpointsQuery.data?.checkpoints?.length ?? 0) > 0;
  const isBusy = createMutation.isPending || restoreMutation.isPending;
  const canCreate = name.trim().length > 0 && !isBusy;

  const submitCreateCheckpoint = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFeedback('Checkpoint name is required');
      return;
    }
    setFeedback('');
    createMutation.mutate({
      name: trimmedName,
      description: description.trim() || undefined
    });
  }, [createMutation, description, name]);

  const checkpointList = useMemo(() => checkpointsQuery.data?.checkpoints ?? [], [checkpointsQuery.data?.checkpoints]);

  const requestRestore = useCallback(
    (checkpoint: ProjectCheckpointSummary) => {
      const confirmed = window.confirm(
        `Restart from checkpoint "${checkpoint.name}"? This replaces the current project state.`
      );
      if (!confirmed) {
        checkpointLogger.debug('Checkpoint restore cancelled by user', {
          projectId,
          checkpointId: checkpoint.id
        });
        return;
      }
      setFeedback('');
      restoreMutation.mutate({
        checkpointId: checkpoint.id,
        checkpointName: checkpoint.name
      });
    },
    [projectId, restoreMutation]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-bw-ink p-6 text-bw-platinum shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-bw-amber">Version control</p>
            <h2 className="text-xl font-semibold">Project checkpoints</h2>
            <p className="text-sm text-bw-platinum/70">
              Save a full project snapshot or restart from a previous checkpoint.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-1 text-sm text-bw-platinum/80 transition hover:bg-white/10"
            disabled={isBusy}
          >
            Close
          </button>
        </div>

        {view === 'menu' && (
          <div className="grid gap-3 sm:grid-cols-2" data-testid="checkpoint-menu">
            <button
              type="button"
              onClick={() => setView('create')}
              className="rounded-xl border border-bw-amber/40 bg-bw-amber/10 px-4 py-4 text-left transition hover:-translate-y-0.5"
            >
              <p className="text-sm font-semibold text-bw-amber">Make new checkpoint</p>
              <p className="mt-1 text-xs text-bw-platinum/70">
                Capture all project data including graph, pages, components, queries, and database schemas.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setView('restore')}
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-4 text-left transition hover:-translate-y-0.5"
            >
              <p className="text-sm font-semibold text-white">Restart from old checkpoint</p>
              <p className="mt-1 text-xs text-bw-platinum/70">
                Browse saved checkpoints for this project and restore one.
              </p>
            </button>
          </div>
        )}

        {view === 'create' && (
          <div className="space-y-3" data-testid="checkpoint-create-view">
            <label className="block text-sm text-bw-platinum/85">
              Name
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-white/20 bg-bw-ink px-3 py-2 text-sm text-white"
                placeholder="Release-ready graph cleanup"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isBusy}
              />
            </label>
            <label className="block text-sm text-bw-platinum/85">
              Description
              <textarea
                className="mt-1 h-28 w-full rounded-lg border border-white/20 bg-bw-ink px-3 py-2 text-sm text-white"
                placeholder="Summarize what changed in this checkpoint"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isBusy}
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-2 text-sm transition hover:bg-white/10"
                onClick={() => setView('menu')}
                disabled={isBusy}
              >
                Back
              </button>
              <button
                type="button"
                onClick={submitCreateCheckpoint}
                className="rounded-lg bg-bw-sand px-4 py-2 text-sm font-semibold text-bw-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canCreate}
              >
                {createMutation.isPending ? 'Saving checkpoint...' : 'Save checkpoint'}
              </button>
            </div>
          </div>
        )}

        {view === 'restore' && (
          <div className="space-y-3" data-testid="checkpoint-restore-view">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-2 text-sm transition hover:bg-white/10"
                onClick={() => setView('menu')}
                disabled={isBusy}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-2 text-sm transition hover:bg-white/10"
                onClick={() => checkpointsQuery.refetch()}
                disabled={checkpointsQuery.isFetching || isBusy}
              >
                {checkpointsQuery.isFetching ? 'Refreshing...' : 'Refresh list'}
              </button>
            </div>

            {checkpointsQuery.isLoading && <p className="text-sm text-bw-platinum/70">Loading checkpoints...</p>}
            {checkpointsQuery.isError && (
              <p className="text-sm text-red-300">
                {checkpointsQuery.error instanceof Error
                  ? checkpointsQuery.error.message
                  : 'Unable to load checkpoints'}
              </p>
            )}
            {!checkpointsQuery.isLoading && !checkpointsQuery.isError && !hasRestoreItems && (
              <p className="text-sm text-bw-platinum/70">No checkpoints saved for this project yet.</p>
            )}

            {hasRestoreItems && (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {checkpointList.map((checkpoint) => {
                  const isRestoringCurrent =
                    restoreMutation.isPending && restoreMutation.variables?.checkpointId === checkpoint.id;
                  return (
                    <div
                      key={checkpoint.id}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-3"
                      data-testid={`checkpoint-item-${checkpoint.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{checkpoint.name}</p>
                          <p className="text-xs text-bw-platinum/65">Captured {formatTimestamp(checkpoint.capturedAt)}</p>
                          {checkpoint.description && (
                            <p className="mt-1 text-xs text-bw-platinum/80">{checkpoint.description}</p>
                          )}
                          <p className="mt-1 text-xs text-bw-platinum/60">
                            {checkpoint.counts.pages} pages, {checkpoint.counts.components} components, {checkpoint.counts.graphNodes} nodes, {checkpoint.counts.queries} queries
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-lg border border-bw-amber/40 bg-bw-amber/10 px-3 py-1 text-xs font-semibold text-bw-amber transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => requestRestore(checkpoint)}
                          disabled={isBusy}
                        >
                          {isRestoringCurrent ? 'Restarting...' : 'Restart'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {feedback && <p className="mt-4 text-sm text-bw-platinum/80">{feedback}</p>}
      </div>
    </div>
  );
};
