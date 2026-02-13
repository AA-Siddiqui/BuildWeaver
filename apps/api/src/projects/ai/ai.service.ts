import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createLlmAdapter,
  AiLogicGenerationResultSchema,
  LOGIC_GENERATION_SYSTEM_PROMPT,
  transformAiLogicOutput
} from '@buildweaver/llm';
import type { LlmAdapter, TransformedLogic } from '@buildweaver/llm';

@Injectable()
export class ProjectAiService {
  private readonly logger = new Logger(ProjectAiService.name);
  private adapter: LlmAdapter | null = null;

  constructor(private readonly config: ConfigService) {}

  private getAdapter(): LlmAdapter {
    if (this.adapter) return this.adapter;

    const baseUrl = this.config.get<string>('LLM_BASE_URL');
    const apiKey = this.config.get<string>('LLM_API_KEY');
    const model = this.config.get<string>('LLM_MODEL');

    if (!baseUrl || !apiKey || !model) {
      this.logger.error('LLM configuration incomplete', {
        hasBaseUrl: !!baseUrl,
        hasApiKey: !!apiKey,
        hasModel: !!model
      });
      throw new Error(
        'LLM is not configured. Set LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL in environment.'
      );
    }

    this.logger.log('Initializing LLM adapter', {
      baseUrl,
      model,
      provider: new URL(baseUrl).hostname
    });

    this.adapter = createLlmAdapter({ baseUrl, apiKey, model });
    return this.adapter;
  }

  async generateLogic(prompt: string): Promise<TransformedLogic> {
    const adapter = this.getAdapter();
    const sanitizedPrompt = prompt.trim();

    this.logger.log('Generating logic from prompt', {
      promptLength: sanitizedPrompt.length,
      promptPreview: sanitizedPrompt.slice(0, 100)
    });

    const result = await adapter.structuredCompletion({
      messages: [
        { role: 'system', content: LOGIC_GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: sanitizedPrompt }
      ],
      schema: AiLogicGenerationResultSchema,
      schemaName: 'logic_generation'
    });

    this.logger.log('LLM response received', {
      nodeCount: result.data.nodes.length,
      edgeCount: result.data.edges.length,
      summary: result.data.summary,
      usage: result.usage
    });

    const transformed = transformAiLogicOutput(
      result.data,
      (message, meta) => this.logger.debug(message, meta)
    );

    this.logger.log('Logic transformation complete', {
      outputNodes: transformed.nodes.length,
      outputEdges: transformed.edges.length,
      summary: transformed.summary
    });

    return transformed;
  }
}
