import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmProviderManager,
  AiLogicGenerationResultSchema,
  AiUiGenerationResultSchema,
  LOGIC_GENERATION_SYSTEM_PROMPT,
  UI_GENERATION_SYSTEM_PROMPT,
  transformAiLogicOutput,
  transformAiUiOutput
} from '@buildweaver/llm';
import type { LlmAdapter, ProviderConfig, AdapterType, TransformedLogic, TransformedUi } from '@buildweaver/llm';

@Injectable()
export class ProjectAiService {
  private readonly logger = new Logger(ProjectAiService.name);
  private adapter: LlmAdapter | null = null;

  constructor(private readonly config: ConfigService) {}

  private getAdapter(): LlmAdapter {
    if (this.adapter) return this.adapter;

    const providerListRaw = this.config.get<string>('PROVIDER_LIST');
    if (!providerListRaw) {
      this.logger.error('PROVIDER_LIST is not set in environment');
      throw new Error(
        'LLM is not configured. Set PROVIDER_LIST and provider-specific env vars.'
      );
    }

    const cooldownPeriod = Number(this.config.get<string>('LLM_COOLDOWN_PERIOD') ?? '300');
    if (Number.isNaN(cooldownPeriod) || cooldownPeriod < 0) {
      this.logger.error('LLM_COOLDOWN_PERIOD is invalid', { raw: cooldownPeriod });
      throw new Error('LLM_COOLDOWN_PERIOD must be a non-negative number (in seconds).');
    }

    const providerNames = providerListRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (providerNames.length === 0) {
      this.logger.error('PROVIDER_LIST is empty after parsing');
      throw new Error('PROVIDER_LIST must contain at least one provider name.');
    }

    this.logger.log('Parsing provider configuration', {
      providerNames,
      cooldownPeriodSeconds: cooldownPeriod
    });

    const providers: ProviderConfig[] = [];

    for (const name of providerNames) {
      const baseUrl = this.config.get<string>(`${name}_BASE_URL`);
      const apiKey = this.config.get<string>(`${name}_API_KEY`);
      const model = this.config.get<string>(`${name}_MODEL`);
      const adapterRaw = this.config.get<string>(`${name}_ADAPTER`);

      if (!baseUrl || !apiKey || !model || !adapterRaw) {
        this.logger.error(`Incomplete config for provider ${name}`, {
          provider: name,
          hasBaseUrl: !!baseUrl,
          hasApiKey: !!apiKey,
          hasModel: !!model,
          hasAdapter: !!adapterRaw
        });
        throw new Error(
          `Provider ${name} is missing required env vars. ` +
            `Set ${name}_BASE_URL, ${name}_API_KEY, ${name}_MODEL, and ${name}_ADAPTER.`
        );
      }

      const adapterType = adapterRaw.toUpperCase() as AdapterType;

      this.logger.log(`Registered provider: ${name}`, {
        provider: name,
        baseUrl,
        model,
        adapterType
      });

      providers.push({ name, baseUrl, apiKey, model, adapterType });
    }

    this.adapter = new LlmProviderManager({
      providers,
      cooldownPeriodSeconds: cooldownPeriod,
      logger: (message, meta) => this.logger.log(message, meta)
    });

    this.logger.log('LlmProviderManager initialised successfully', {
      providerCount: providers.length,
      providerOrder: providers.map((p) => p.name)
    });

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

  async generateUi(prompt: string): Promise<TransformedUi> {
    const adapter = this.getAdapter();
    const sanitizedPrompt = prompt.trim();

    this.logger.log('Generating UI from prompt', {
      promptLength: sanitizedPrompt.length,
      promptPreview: sanitizedPrompt.slice(0, 100)
    });

    const result = await adapter.structuredCompletion({
      messages: [
        { role: 'system', content: UI_GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: sanitizedPrompt }
      ],
      schema: AiUiGenerationResultSchema,
      schemaName: 'ui_generation'
    });

    this.logger.log('LLM UI response received', {
      sectionCount: result.data.sections.length,
      summary: result.data.summary,
      usage: result.usage
    });

    const transformed = transformAiUiOutput(
      result.data,
      (message, meta) => this.logger.debug(message, meta)
    );

    this.logger.log('UI transformation complete', {
      contentItems: transformed.data.content.length,
      zoneCount: Object.keys(transformed.data.zones ?? {}).length,
      summary: transformed.summary
    });

    return transformed;
  }
}
