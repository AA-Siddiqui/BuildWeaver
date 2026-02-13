import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type {
  LlmAdapter,
  LlmAdapterConfig,
  StructuredCompletionRequest,
  StructuredCompletionResult
} from './types';

/**
 * OpenAI-compatible adapter. Works with OpenAI, OpenRouter, Groq, and any
 * provider that exposes an OpenAI-compatible chat completions endpoint.
 */
export class OpenAIAdapter implements LlmAdapter {
  public readonly providerName: string;
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(config: LlmAdapterConfig) {
    this.providerName = `openai-compat(${new URL(config.baseUrl).hostname})`;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      dangerouslyAllowBrowser: false
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
    this.temperature = config.temperature ?? 0.2;
  }

  async structuredCompletion<T>(
    request: StructuredCompletionRequest<T>
  ): Promise<StructuredCompletionResult<T>> {
    const { messages, schema, schemaName } = request;

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      response_format: zodResponseFormat(schema, schemaName)
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error(`[${this.providerName}] Empty response from model`);
    }

    const raw = JSON.parse(choice.message.content) as T;

    return {
      data: raw,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens
          }
        : undefined
    };
  }
}
