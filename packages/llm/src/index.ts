export type { PromptRequest } from './compat';
export { mockPrompt } from './compat';

export type {
  AdapterType,
  LlmAdapter,
  LlmAdapterConfig,
  LlmMessage,
  LlmUsage,
  LogFn,
  ProviderConfig,
  ProviderManagerConfig,
  StructuredCompletionRequest,
  StructuredCompletionResult
} from './types';

export { OpenAIAdapter } from './openai-adapter';
export { LlmProviderManager } from './provider-manager';

export {
  AiNodeSchema,
  AiEdgeSchema,
  AiLogicGenerationResultSchema
} from './schemas/logic-generation';
export type { AiNode, AiEdge, AiLogicGenerationResult } from './schemas/logic-generation';

export { AiUiGenerationResultSchema, AI_DEFAULT_STYLE } from './schemas/ui-generation';
export type { AiUiGenerationResult, AiComponentStyle } from './schemas/ui-generation';

export { LOGIC_GENERATION_SYSTEM_PROMPT } from './prompts/logic-system-prompt';
export { UI_GENERATION_SYSTEM_PROMPT } from './prompts/ui-system-prompt';

export { transformAiLogicOutput } from './logic-transformer';
export type { TransformedLogic } from './logic-transformer';

export { transformAiUiOutput, resetUiTransformerIdCounter } from './ui-transformer';
export type { TransformedUi } from './ui-transformer';

import type { LlmAdapterConfig } from './types';
import { OpenAIAdapter } from './openai-adapter';

/**
 * Factory: creates the appropriate LLM adapter from config.
 * Currently only supports OpenAI-compatible providers (OpenAI, OpenRouter, Groq).
 * Add new adapter types here when needed.
 */
export function createLlmAdapter(config: LlmAdapterConfig): OpenAIAdapter {
  return new OpenAIAdapter(config);
}
