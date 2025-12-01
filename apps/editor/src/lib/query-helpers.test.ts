import type { QueryClient } from '@tanstack/react-query';
import { invalidateProjectGraphCache, projectGraphQueryKey } from './query-helpers';

describe('query helpers', () => {
  it('builds deterministic project graph keys', () => {
    expect(projectGraphQueryKey('proj-1')).toEqual(['project-graph', 'proj-1']);
  });

  it('invalidates the project graph cache when project id is provided', async () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    const client = { invalidateQueries } as unknown as QueryClient;
    const logger = jest.fn();

    const result = await invalidateProjectGraphCache(client, 'proj-123', { reason: 'unit' }, logger);

    expect(result).toBe(true);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['project-graph', 'proj-123'] });
    expect(logger).toHaveBeenCalledWith('Project graph cache invalidation requested', {
      projectId: 'proj-123',
      reason: 'unit'
    });
    expect(logger).toHaveBeenCalledWith('Project graph cache invalidated', {
      projectId: 'proj-123',
      reason: 'unit'
    });
  });

  it('skips invalidation when project id is missing', async () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    const client = { invalidateQueries } as unknown as QueryClient;
    const logger = jest.fn();

    const result = await invalidateProjectGraphCache(client, undefined, { reason: 'unit' }, logger);

    expect(result).toBe(false);
    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith('Project graph cache invalidation skipped — missing project id', {
      reason: 'unit'
    });
  });
});
