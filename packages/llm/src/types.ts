import type { ZodType } from 'zod';

/** Configuration for an OpenAI-compatible LLM provider. */
export interface LlmAdapterConfig {
  /** Base URL of the API (e.g. https://api.openai.com/v1). */
  baseUrl: string;
  /** API key / bearer token. */
  apiKey: string;
  /** Model identifier (e.g. gpt-4o, deepseek-chat). */
  model: string;
  /** Maximum tokens in the completion (default 4096). */
  maxTokens?: number;
  /** Sampling temperature (default 0.2). */
  temperature?: number;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StructuredCompletionRequest<T> {
  messages: LlmMessage[];
  schema: ZodType<T>;
  schemaName: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StructuredCompletionResult<T> {
  data: T;
  usage?: LlmUsage;
}

/** Adapter interface for LLM providers. */
export interface LlmAdapter {
  readonly providerName: string;

  structuredCompletion<T>(
    request: StructuredCompletionRequest<T>
  ): Promise<StructuredCompletionResult<T>>;
}

/** Supported adapter types. */
export type AdapterType = 'OPENAI' | 'GOOGLE' | 'ANTHROPIC';

/** Configuration for a single named provider in the provider list. */
export interface ProviderConfig {
  /** Unique provider name as declared in PROVIDER_LIST (e.g. "OPENAI", "GROQ"). */
  name: string;
  /** Base URL of the API. */
  baseUrl: string;
  /** API key / bearer token. */
  apiKey: string;
  /** Model identifier. */
  model: string;
  /** Which adapter implementation to use. */
  adapterType: AdapterType;
}

/** Configuration for the multi-provider manager. */
export interface ProviderManagerConfig {
  /** Ordered list of provider configs. First provider is tried first. */
  providers: ProviderConfig[];
  /** Cooldown period in seconds. A failed provider is skipped for this duration. */
  cooldownPeriodSeconds: number;
  /** Optional logger function. */
  logger?: LogFn;
}

/** Logger callback compatible with NestJS Logger and plain functions. */
export type LogFn = (message: string, meta?: Record<string, unknown>) => void;
