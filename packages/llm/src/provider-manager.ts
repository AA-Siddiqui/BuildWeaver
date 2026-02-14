import { OpenAIAdapter } from './openai-adapter';
import type {
  AdapterType,
  LlmAdapter,
  LogFn,
  ProviderConfig,
  ProviderManagerConfig,
  StructuredCompletionRequest,
  StructuredCompletionResult
} from './types';

interface ProviderEntry {
  name: string;
  adapter: LlmAdapter;
  cooldownUntil: number; // epoch ms – 0 means not in cooldown
}

/**
 * Manages an ordered list of LLM providers with automatic failover
 * and cooldown. If the first provider fails, the next one is tried,
 * and the failed provider is put in cooldown for the configured period.
 *
 * Implements `LlmAdapter` so it can be used as a drop-in replacement.
 */
export class LlmProviderManager implements LlmAdapter {
  public readonly providerName: string;
  private readonly providers: ProviderEntry[];
  private readonly cooldownPeriodMs: number;
  private readonly log: LogFn;

  constructor(config: ProviderManagerConfig) {
    if (config.providers.length === 0) {
      throw new Error('LlmProviderManager requires at least one provider');
    }

    this.cooldownPeriodMs = config.cooldownPeriodSeconds * 1000;
    this.log = config.logger ?? (() => {});

    this.providers = config.providers.map((p) => ({
      name: p.name,
      adapter: createAdapterForType(p),
      cooldownUntil: 0
    }));

    const names = this.providers.map((p) => p.name).join(',');
    this.providerName = `multi-provider(${names})`;

    this.log('LlmProviderManager initialised', {
      providers: names,
      cooldownPeriodSeconds: config.cooldownPeriodSeconds
    });
  }

  async structuredCompletion<T>(
    request: StructuredCompletionRequest<T>
  ): Promise<StructuredCompletionResult<T>> {
    const errors: Array<{ provider: string; error: string }> = [];

    for (const entry of this.providers) {
      const now = Date.now();

      if (entry.cooldownUntil > now) {
        const remainingSec = Math.ceil((entry.cooldownUntil - now) / 1000);
        this.log(`Skipping provider ${entry.name} – in cooldown`, {
          provider: entry.name,
          cooldownRemainingSeconds: remainingSec
        });
        continue;
      }

      try {
        this.log(`Attempting completion with provider ${entry.name}`, {
          provider: entry.name,
          model: entry.adapter.providerName
        });

        const result = await entry.adapter.structuredCompletion(request);

        this.log(`Provider ${entry.name} succeeded`, {
          provider: entry.name,
          usage: result.usage
        });

        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);

        this.log(`Provider ${entry.name} failed – entering cooldown`, {
          provider: entry.name,
          error: message,
          cooldownPeriodSeconds: this.cooldownPeriodMs / 1000
        });

        entry.cooldownUntil = now + this.cooldownPeriodMs;
        errors.push({ provider: entry.name, error: message });
      }
    }

    const detail = errors.map((e) => `${e.provider}: ${e.error}`).join('; ');
    throw new Error(`All LLM providers failed. Details: ${detail}`);
  }
}

function createAdapterForType(config: ProviderConfig): LlmAdapter {
  const type: AdapterType = config.adapterType;

  switch (type) {
    case 'OPENAI':
      return new OpenAIAdapter({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model
      });

    case 'GOOGLE':
      throw new Error(
        `Adapter type GOOGLE is not yet implemented (provider: ${config.name})`
      );

    case 'ANTHROPIC':
      throw new Error(
        `Adapter type ANTHROPIC is not yet implemented (provider: ${config.name})`
      );

    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown adapter type: ${String(exhaustive)} (provider: ${config.name})`);
    }
  }
}
