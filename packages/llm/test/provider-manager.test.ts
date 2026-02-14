import { LlmProviderManager } from '../src/provider-manager';
import type {
  LlmAdapter,
  ProviderConfig,
  StructuredCompletionRequest,
  StructuredCompletionResult
} from '../src/types';

// --- Mock the OpenAI SDK (needed because provider-manager imports OpenAIAdapter) ---
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } }
  }));
});

jest.mock('openai/helpers/zod', () => ({
  zodResponseFormat: jest.fn((_schema: unknown, name: string) => ({
    type: 'json_schema',
    json_schema: { name, strict: true }
  }))
}));

// --- Helper: create a mock LlmAdapter ---
function createMockAdapter(
  name: string,
  impl?: () => Promise<StructuredCompletionResult<unknown>>
): LlmAdapter {
  return {
    providerName: name,
    structuredCompletion: jest.fn(
      impl ?? (() => Promise.resolve({ data: { ok: true }, usage: undefined }))
    ) as LlmAdapter['structuredCompletion']
  };
}

// --- Helper: create a dummy request ---
function dummyRequest(): StructuredCompletionRequest<unknown> {
  // We won't actually validate; the mock adapters bypass Zod.
  return {
    messages: [{ role: 'user', content: 'test' }],
    schema: {} as never,
    schemaName: 'test'
  };
}

describe('LlmProviderManager', () => {
  it('should throw when created with zero providers', () => {
    expect(
      () =>
        new LlmProviderManager({
          providers: [],
          cooldownPeriodSeconds: 60
        })
    ).toThrow('at least one provider');
  });

  it('should set providerName from all provider names', () => {
    const configs: ProviderConfig[] = [
      {
        name: 'OPENAI',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'k1',
        model: 'gpt-4o',
        adapterType: 'OPENAI'
      },
      {
        name: 'GROQ',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: 'k2',
        model: 'm2',
        adapterType: 'OPENAI'
      }
    ];

    const mgr = new LlmProviderManager({ providers: configs, cooldownPeriodSeconds: 60 });
    expect(mgr.providerName).toBe('multi-provider(OPENAI,GROQ)');
  });

  it('should throw for unsupported GOOGLE adapter type', () => {
    expect(
      () =>
        new LlmProviderManager({
          providers: [
            {
              name: 'GOOGLE',
              baseUrl: 'https://google.example.com',
              apiKey: 'k',
              model: 'm',
              adapterType: 'GOOGLE'
            }
          ],
          cooldownPeriodSeconds: 60
        })
    ).toThrow('GOOGLE is not yet implemented');
  });

  it('should throw for unsupported ANTHROPIC adapter type', () => {
    expect(
      () =>
        new LlmProviderManager({
          providers: [
            {
              name: 'ANTHROPIC',
              baseUrl: 'https://anthropic.example.com',
              apiKey: 'k',
              model: 'm',
              adapterType: 'ANTHROPIC'
            }
          ],
          cooldownPeriodSeconds: 60
        })
    ).toThrow('ANTHROPIC is not yet implemented');
  });

  it('should call the logger on initialisation', () => {
    const logger = jest.fn();
    new LlmProviderManager({
      providers: [
        {
          name: 'P1',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'k',
          model: 'm',
          adapterType: 'OPENAI'
        }
      ],
      cooldownPeriodSeconds: 120,
      logger
    });

    expect(logger).toHaveBeenCalledWith(
      'LlmProviderManager initialised',
      expect.objectContaining({ providers: 'P1', cooldownPeriodSeconds: 120 })
    );
  });
});

/**
 * For the failover / cooldown tests we need to inject mock adapters.
 * We do that by constructing with real OPENAI configs (so createAdapterForType
 * succeeds) and then overwriting the internal providers array via a subclass.
 */
class TestableLlmProviderManager extends LlmProviderManager {
  constructor(
    adapters: LlmAdapter[],
    cooldownPeriodSeconds: number,
    logger?: (message: string, meta?: Record<string, unknown>) => void
  ) {
    // Create dummy OPENAI configs so the parent constructor succeeds.
    const dummyConfigs: ProviderConfig[] = adapters.map((a, i) => ({
      name: `PROVIDER_${i}`,
      baseUrl: 'https://api.openai.com/v1',
      apiKey: `key-${i}`,
      model: `model-${i}`,
      adapterType: 'OPENAI' as const
    }));

    super({ providers: dummyConfigs, cooldownPeriodSeconds, logger });

    // Overwrite internal providers with our mock adapters.
    const entries = (this as unknown as { providers: Array<{ name: string; adapter: LlmAdapter; cooldownUntil: number }> }).providers;
    for (let i = 0; i < adapters.length; i++) {
      entries[i].adapter = adapters[i];
      entries[i].name = adapters[i].providerName;
    }

    // Fix providerName to reflect actual mock names.
    (this as unknown as { providerName: string }).providerName =
      `multi-provider(${adapters.map((a) => a.providerName).join(',')})`;
  }
}

describe('LlmProviderManager failover', () => {
  it('should succeed with the first provider when it works', async () => {
    const adapter1 = createMockAdapter('provider-A');
    const adapter2 = createMockAdapter('provider-B');
    const mgr = new TestableLlmProviderManager([adapter1, adapter2], 60);

    const result = await mgr.structuredCompletion(dummyRequest());

    expect(result.data).toEqual({ ok: true });
    expect(adapter1.structuredCompletion).toHaveBeenCalledTimes(1);
    expect(adapter2.structuredCompletion).toHaveBeenCalledTimes(0);
  });

  it('should failover to second provider when first fails', async () => {
    const adapter1 = createMockAdapter('provider-A', () =>
      Promise.reject(new Error('rate limit'))
    );
    const adapter2 = createMockAdapter('provider-B', () =>
      Promise.resolve({ data: { fallback: true }, usage: undefined })
    );
    const logger = jest.fn();
    const mgr = new TestableLlmProviderManager([adapter1, adapter2], 60, logger);

    const result = await mgr.structuredCompletion(dummyRequest());

    expect(result.data).toEqual({ fallback: true });
    expect(adapter1.structuredCompletion).toHaveBeenCalledTimes(1);
    expect(adapter2.structuredCompletion).toHaveBeenCalledTimes(1);

    // Check that the failure was logged
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('provider-A failed'),
      expect.objectContaining({ error: 'rate limit' })
    );
  });

  it('should throw when all providers fail', async () => {
    const adapter1 = createMockAdapter('provider-A', () =>
      Promise.reject(new Error('error-A'))
    );
    const adapter2 = createMockAdapter('provider-B', () =>
      Promise.reject(new Error('error-B'))
    );
    const mgr = new TestableLlmProviderManager([adapter1, adapter2], 60);

    await expect(mgr.structuredCompletion(dummyRequest())).rejects.toThrow(
      'All LLM providers failed'
    );
  });

  it('should include all error details when all providers fail', async () => {
    const adapter1 = createMockAdapter('p1', () =>
      Promise.reject(new Error('timeout'))
    );
    const adapter2 = createMockAdapter('p2', () =>
      Promise.reject(new Error('auth failed'))
    );
    const mgr = new TestableLlmProviderManager([adapter1, adapter2], 60);

    try {
      await mgr.structuredCompletion(dummyRequest());
      fail('should have thrown');
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toContain('p1: timeout');
      expect(msg).toContain('p2: auth failed');
    }
  });

  it('should skip a provider in cooldown', async () => {
    const adapter1 = createMockAdapter('provider-A', () =>
      Promise.reject(new Error('down'))
    );
    const adapter2 = createMockAdapter('provider-B');
    const mgr = new TestableLlmProviderManager([adapter1, adapter2], 300);

    // First call: A fails, falls back to B
    await mgr.structuredCompletion(dummyRequest());
    expect(adapter1.structuredCompletion).toHaveBeenCalledTimes(1);
    expect(adapter2.structuredCompletion).toHaveBeenCalledTimes(1);

    // Second call: A should be in cooldown, goes straight to B
    await mgr.structuredCompletion(dummyRequest());
    expect(adapter1.structuredCompletion).toHaveBeenCalledTimes(1); // NOT called again
    expect(adapter2.structuredCompletion).toHaveBeenCalledTimes(2);
  });

  it('should retry a provider after cooldown expires', async () => {
    const callCount = { a: 0 };
    const adapter1 = createMockAdapter('provider-A', () => {
      callCount.a++;
      if (callCount.a === 1) {
        return Promise.reject(new Error('transient'));
      }
      return Promise.resolve({ data: { recovered: true }, usage: undefined });
    });
    const adapter2 = createMockAdapter('provider-B');
    // Use cooldown of 0 seconds so it expires immediately
    const mgr = new TestableLlmProviderManager([adapter1, adapter2], 0);

    // First call: A fails, falls back to B
    await mgr.structuredCompletion(dummyRequest());
    expect(callCount.a).toBe(1);
    expect(adapter2.structuredCompletion).toHaveBeenCalledTimes(1);

    // Second call: cooldown is 0s, so A is retried and now succeeds
    const result = await mgr.structuredCompletion(dummyRequest());
    expect(callCount.a).toBe(2);
    expect(result.data).toEqual({ recovered: true });
    // B should not have been called again
    expect(adapter2.structuredCompletion).toHaveBeenCalledTimes(1);
  });

  it('should log when skipping a provider in cooldown', async () => {
    const adapter1 = createMockAdapter('prov-X', () =>
      Promise.reject(new Error('fail'))
    );
    const adapter2 = createMockAdapter('prov-Y');
    const logger = jest.fn();
    const mgr = new TestableLlmProviderManager([adapter1, adapter2], 600, logger);

    // First call: X fails
    await mgr.structuredCompletion(dummyRequest());

    // Second call: X should be logged as skipped
    await mgr.structuredCompletion(dummyRequest());

    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('Skipping provider prov-X'),
      expect.objectContaining({ provider: 'prov-X' })
    );
  });

  it('should log success when a provider succeeds', async () => {
    const adapter1 = createMockAdapter('provider-OK');
    const logger = jest.fn();
    const mgr = new TestableLlmProviderManager([adapter1], 60, logger);

    await mgr.structuredCompletion(dummyRequest());

    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('provider-OK succeeded'),
      expect.objectContaining({ provider: 'provider-OK' })
    );
  });

  it('should work with a single provider', async () => {
    const adapter1 = createMockAdapter('solo', () =>
      Promise.resolve({ data: { single: true }, usage: undefined })
    );
    const mgr = new TestableLlmProviderManager([adapter1], 60);

    const result = await mgr.structuredCompletion(dummyRequest());
    expect(result.data).toEqual({ single: true });
  });

  it('should handle non-Error thrown values', async () => {
    const adapter1 = createMockAdapter('str-err', () =>
      Promise.reject('string error')
    );
    const adapter2 = createMockAdapter('ok');
    const mgr = new TestableLlmProviderManager([adapter1, adapter2], 60);

    const result = await mgr.structuredCompletion(dummyRequest());
    expect(result.data).toEqual({ ok: true });
  });

  it('should failover across three providers', async () => {
    const a1 = createMockAdapter('A', () => Promise.reject(new Error('A down')));
    const a2 = createMockAdapter('B', () => Promise.reject(new Error('B down')));
    const a3 = createMockAdapter('C', () =>
      Promise.resolve({ data: { third: true }, usage: undefined })
    );
    const mgr = new TestableLlmProviderManager([a1, a2, a3], 60);

    const result = await mgr.structuredCompletion(dummyRequest());
    expect(result.data).toEqual({ third: true });
    expect(a1.structuredCompletion).toHaveBeenCalledTimes(1);
    expect(a2.structuredCompletion).toHaveBeenCalledTimes(1);
    expect(a3.structuredCompletion).toHaveBeenCalledTimes(1);
  });
});
