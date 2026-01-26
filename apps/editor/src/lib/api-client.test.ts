import { apiFetch } from './api-client';

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
});
