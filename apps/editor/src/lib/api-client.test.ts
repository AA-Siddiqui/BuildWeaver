import { apiFetch, projectCheckpointsApi } from './api-client';

describe('apiFetch error handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns nested message from error payload', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ statusCode: 400, message: 'Invalid connection', error: 'Bad Request' })
    } as unknown as Response;

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as unknown as typeof fetch;

    await expect(apiFetch('/test')).rejects.toThrow('Invalid connection');
  });

  it('falls back to status text when payload is missing message', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ statusCode: 500, error: 'Internal Server Error' })
    } as unknown as Response;

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as unknown as typeof fetch;

    await expect(apiFetch('/test')).rejects.toThrow('Internal Server Error');
  });

  it('calls checkpoint endpoints with expected paths and methods', async () => {
    const jsonHeaders = new Headers({ 'content-type': 'application/json' });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: jsonHeaders,
        json: async () => ({ success: true, data: { checkpoints: [] } })
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: jsonHeaders,
        json: async () => ({
          success: true,
          data: {
            checkpoint: {
              id: 'checkpoint-1',
              projectId: 'project-1',
              name: 'Baseline',
              description: 'initial snapshot',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              capturedAt: new Date().toISOString(),
              counts: {
                pages: 1,
                components: 0,
                deployments: 0,
                graphNodes: 2,
                graphEdges: 0,
                functions: 0,
                databases: 0,
                queries: 0
              }
            }
          }
        })
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: jsonHeaders,
        json: async () => ({
          success: true,
          data: {
            checkpoint: {
              id: 'checkpoint-1',
              projectId: 'project-1',
              name: 'Baseline',
              description: 'initial snapshot',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              capturedAt: new Date().toISOString(),
              counts: {
                pages: 1,
                components: 0,
                deployments: 0,
                graphNodes: 2,
                graphEdges: 0,
                functions: 0,
                databases: 0,
                queries: 0
              }
            }
          }
        })
      } as unknown as Response) as unknown as typeof fetch;

    await projectCheckpointsApi.list('project-1');
    await projectCheckpointsApi.create('project-1', {
      name: 'Baseline',
      description: 'initial snapshot'
    });
    await projectCheckpointsApi.restore('project-1', 'checkpoint-1');

    const fetchMock = global.fetch as unknown as jest.Mock;
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/projects/project-1/checkpoints');
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3000/projects/project-1/checkpoints');
    expect(fetchMock.mock.calls[2][0]).toBe(
      'http://localhost:3000/projects/project-1/checkpoints/checkpoint-1/restore'
    );

    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBe(
      JSON.stringify({ name: 'Baseline', description: 'initial snapshot' })
    );
  });
});
