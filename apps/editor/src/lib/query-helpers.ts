import type { QueryClient, QueryKey } from '@tanstack/react-query';

export type QueryLogger = (message: string, details?: Record<string, unknown>) => void;

export const projectGraphQueryKey = (projectId: string): QueryKey => ['project-graph', projectId];

export const invalidateProjectGraphCache = async (
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
  projectId?: string,
  context?: { reason?: string },
  logger?: QueryLogger
): Promise<boolean> => {
  if (!projectId) {
    logger?.('Project graph cache invalidation skipped — missing project id', context);
    return false;
  }

  const details = { projectId, ...context };
  logger?.('Project graph cache invalidation requested', details);
  await queryClient.invalidateQueries({ queryKey: projectGraphQueryKey(projectId) });
  logger?.('Project graph cache invalidated', details);
  return true;
};
