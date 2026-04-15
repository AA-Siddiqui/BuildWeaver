import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmProviderManager,
  AiAgentEditScopeSchema,
  AiLogicAgentLoopStepSchema,
  AiLogicGenerationResultSchema,
  AiUiAgentLoopStepSchema,
  AiUiGenerationResultSchema,
  AGENT_EDIT_SCOPE_SYSTEM_PROMPT,
  LOGIC_AGENT_LOOP_SYSTEM_PROMPT,
  LOGIC_GENERATION_SYSTEM_PROMPT,
  UI_AGENT_LOOP_SYSTEM_PROMPT,
  UI_GENERATION_SYSTEM_PROMPT,
  transformAiLogicOutput,
  transformAiUiOutput
} from '@buildweaver/llm';
import type {
  AdapterType,
  AiAgentEditScope,
  AiLogicAgentLoopStep,
  AiUiAgentLoopStep,
  LlmAdapter,
  LlmMessage,
  LlmUsage,
  ProviderConfig,
  TransformedLogic,
  TransformedUi
} from '@buildweaver/llm';

const DEFAULT_AGENT_MAX_STEPS = 12;
const ABSOLUTE_AGENT_MAX_STEPS = 64;
const AGENT_MAX_STEP_ENV_KEYS = ['AI_AGENT_MAX_STEPS', 'LLM_AGENT_MAX_STEPS'] as const;
const STEP_RECOMMENDATION_PATTERN = /\b(maybe|perhaps|consider|could|option|alternatively)\b/i;
const RECOVERABLE_AGENT_LOOP_ERROR_PATTERN =
  /repeated a previous step|cannot make progress|without a stop signal|empty next-step prompt/i;

export interface AiGenerationOptions {
  agentMode?: boolean;
  agentMaxSteps?: number;
}

export interface AgentGenerationResult {
  summary: string;
  routing: {
    applyUi: boolean;
    applyLogic: boolean;
    reason: string;
    uiPrompt?: string;
    logicPrompt?: string;
  };
  ui?: TransformedUi;
  logic?: TransformedLogic;
}

interface AgentModeConfig {
  enabled: boolean;
  maxSteps: number;
}

interface UsageSummary {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

@Injectable()
export class ProjectAiService {
  private readonly logger = new Logger(ProjectAiService.name);
  private adapter: LlmAdapter | null = null;
  private resolvedAgentMaxSteps: { value: number; source: string } | null = null;

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

    const cooldownRaw = this.config.get<string>('LLM_COOLDOWN_PERIOD') ?? '300';
    const cooldownPeriod = Number(cooldownRaw);
    if (Number.isNaN(cooldownPeriod) || cooldownPeriod < 0) {
      this.logger.error('LLM_COOLDOWN_PERIOD is invalid', { raw: cooldownRaw });
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

  private resolveAgentModeConfig(options?: AiGenerationOptions): AgentModeConfig {
    const enabled = options?.agentMode === true;
    const configuredLimit = this.resolveConfiguredAgentMaxSteps();

    if (!enabled) {
      return {
        enabled: false,
        maxSteps: configuredLimit.value
      };
    }

    if (typeof options?.agentMaxSteps === 'number') {
      this.logger.warn('Ignoring request-provided agent max steps in favor of server hard limit', {
        requested: options.agentMaxSteps,
        effective: configuredLimit.value,
        source: configuredLimit.source
      });
    }

    return {
      enabled: true,
      maxSteps: configuredLimit.value
    };
  }

  private resolveConfiguredAgentMaxSteps(): { value: number; source: string } {
    if (this.resolvedAgentMaxSteps) {
      return this.resolvedAgentMaxSteps;
    }

    for (const key of AGENT_MAX_STEP_ENV_KEYS) {
      const raw = this.config.get<string>(key);
      if (typeof raw === 'undefined') {
        continue;
      }

      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 1) {
        this.logger.warn('Ignoring invalid agent max-step environment value', {
          key,
          raw,
          fallback: DEFAULT_AGENT_MAX_STEPS
        });
        continue;
      }

      const rounded = Math.floor(parsed);
      const bounded = Math.min(Math.max(rounded, 1), ABSOLUTE_AGENT_MAX_STEPS);
      if (bounded !== rounded) {
        this.logger.warn('Configured agent max steps exceeded safe bounds and was clamped', {
          key,
          configured: rounded,
          effective: bounded,
          min: 1,
          max: ABSOLUTE_AGENT_MAX_STEPS
        });
      }

      this.resolvedAgentMaxSteps = {
        value: bounded,
        source: key
      };
      this.logger.log('Resolved agent max-step hard limit from environment', this.resolvedAgentMaxSteps);
      return this.resolvedAgentMaxSteps;
    }

    this.resolvedAgentMaxSteps = {
      value: DEFAULT_AGENT_MAX_STEPS,
      source: 'default'
    };
    this.logger.log('Using default agent max-step hard limit', this.resolvedAgentMaxSteps);
    return this.resolvedAgentMaxSteps;
  }

  private createUsageSummary(): UsageSummary {
    return {
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
  }

  private recordUsage(
    context: string,
    summary: UsageSummary,
    usage?: LlmUsage,
    details?: Record<string, unknown>
  ) {
    summary.calls += 1;

    if (!usage) {
      this.logger.warn('LLM usage missing for completion call', {
        context,
        calls: summary.calls,
        ...(details ?? {})
      });
      return;
    }

    summary.promptTokens += usage.promptTokens;
    summary.completionTokens += usage.completionTokens;
    summary.totalTokens += usage.totalTokens;

    this.logger.log('LLM usage recorded', {
      context,
      usage,
      cumulative: {
        calls: summary.calls,
        promptTokens: summary.promptTokens,
        completionTokens: summary.completionTokens,
        totalTokens: summary.totalTokens
      },
      ...(details ?? {})
    });
  }

  private logUsageSummary(context: string, usage: UsageSummary) {
    this.logger.log('LLM usage summary', {
      context,
      calls: usage.calls,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens
    });
  }

  private ensurePrompt(prompt: string): string {
    const sanitizedPrompt = prompt.trim();
    if (!sanitizedPrompt) {
      throw new Error('Prompt is empty after trimming');
    }
    return sanitizedPrompt;
  }

  private normalizeStepPrompt(prompt: string): string {
    return prompt
      .trim()
      .replace(/\s+/g, ' ');
  }

  private buildAgentLoopMessages(
    orchestrationPrompt: string,
    generationPrompt: string,
    goalPrompt: string,
    currentStepPrompt: string,
    previousStepPrompts: string[],
    iteration: number,
    maxSteps: number
  ): LlmMessage[] {
    const historyText =
      previousStepPrompts.length === 0
        ? 'none'
        : previousStepPrompts.map((stepPrompt, index) => `${index + 1}. ${stepPrompt}`).join('\n');

    const userInstruction = [
      'Overall user goal:',
      goalPrompt,
      '',
      `Iteration: ${iteration}/${maxSteps}`,
      'Previous continue prompts:',
      historyText,
      '',
      'Current step prompt:',
      currentStepPrompt,
      '',
      'Return only one structured object according to the schema.'
    ].join('\n');

    return [
      { role: 'system', content: orchestrationPrompt },
      { role: 'system', content: generationPrompt },
      { role: 'user', content: userInstruction }
    ];
  }

  private isRecoverableAgentLoopError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return RECOVERABLE_AGENT_LOOP_ERROR_PATTERN.test(message);
  }

  private async generateLogicSinglePass(
    adapter: LlmAdapter,
    sanitizedPrompt: string,
    context: 'standard' | 'agent-fallback'
  ): Promise<TransformedLogic> {
    this.logger.log('Executing logic single-pass generation', {
      context,
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

    this.logger.log('LLM logic single-pass response received', {
      context,
      nodeCount: result.data.nodes.length,
      edgeCount: result.data.edges.length,
      summary: result.data.summary,
      usage: result.usage
    });

    const transformed = transformAiLogicOutput(
      result.data,
      (message, meta) => this.logger.debug(message, meta)
    );

    this.logger.log('Logic single-pass transformation complete', {
      context,
      outputNodes: transformed.nodes.length,
      outputEdges: transformed.edges.length,
      summary: transformed.summary
    });

    return transformed;
  }

  private async generateUiSinglePass(
    adapter: LlmAdapter,
    sanitizedPrompt: string,
    context: 'standard' | 'agent-fallback'
  ): Promise<TransformedUi> {
    this.logger.log('Executing UI single-pass generation', {
      context,
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

    this.logger.log('LLM UI single-pass response received', {
      context,
      sectionCount: result.data.sections.length,
      summary: result.data.summary,
      usage: result.usage
    });

    const transformed = transformAiUiOutput(
      result.data,
      (message, meta) => this.logger.debug(message, meta)
    );

    this.logger.log('UI single-pass transformation complete', {
      context,
      contentItems: transformed.data.content.length,
      zoneCount: Object.keys(transformed.data.zones ?? {}).length,
      summary: transformed.summary
    });

    return transformed;
  }

  private async decideAgentEditScope(
    adapter: LlmAdapter,
    prompt: string,
    usageSummary: UsageSummary
  ): Promise<AiAgentEditScope> {
    this.logger.log('Agent edit-scope routing started', {
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 120)
    });

    const response = await adapter.structuredCompletion({
      messages: [
        { role: 'system', content: AGENT_EDIT_SCOPE_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      schema: AiAgentEditScopeSchema,
      schemaName: 'agent_edit_scope'
    });

    this.recordUsage('agent-edit-scope', usageSummary, response.usage);

    const decision = response.data as AiAgentEditScope;
    const normalizedUiPrompt = decision.uiPrompt ? this.normalizeStepPrompt(decision.uiPrompt) : undefined;
    const normalizedLogicPrompt = decision.logicPrompt ? this.normalizeStepPrompt(decision.logicPrompt) : undefined;

    if (!decision.applyUi && !decision.applyLogic) {
      this.logger.error('Agent edit-scope returned no applicable targets', {
        reason: decision.reason
      });
      throw new Error('Agent mode could not determine a valid edit target.');
    }

    this.logger.log('Agent edit-scope routing resolved', {
      applyUi: decision.applyUi,
      applyLogic: decision.applyLogic,
      reason: decision.reason,
      uiPromptLength: normalizedUiPrompt?.length ?? 0,
      logicPromptLength: normalizedLogicPrompt?.length ?? 0
    });

    return {
      ...decision,
      ...(normalizedUiPrompt ? { uiPrompt: normalizedUiPrompt } : {}),
      ...(normalizedLogicPrompt ? { logicPrompt: normalizedLogicPrompt } : {})
    };
  }

  private async generateLogicWithAgentMode(
    adapter: LlmAdapter,
    goalPrompt: string,
    maxSteps: number
  ): Promise<TransformedLogic> {
    const usageSummary = this.createUsageSummary();
    const seenStepPrompts = new Set<string>();
    const previousStepPrompts: string[] = [];

    let currentStepPrompt = goalPrompt;

    for (let iteration = 1; iteration <= maxSteps; iteration += 1) {
      this.logger.log('Agent mode logic iteration started', {
        iteration,
        maxSteps,
        currentPromptLength: currentStepPrompt.length,
        currentPromptPreview: currentStepPrompt.slice(0, 120),
        previousStepCount: previousStepPrompts.length
      });

      const response = await adapter.structuredCompletion({
        messages: this.buildAgentLoopMessages(
          LOGIC_AGENT_LOOP_SYSTEM_PROMPT,
          LOGIC_GENERATION_SYSTEM_PROMPT,
          goalPrompt,
          currentStepPrompt,
          previousStepPrompts,
          iteration,
          maxSteps
        ),
        schema: AiLogicAgentLoopStepSchema,
        schemaName: 'logic_agent_loop_step'
      });

      this.recordUsage('logic-agent-loop', usageSummary, response.usage, {
        iteration,
        action: response.data.action
      });

      const decision = response.data as AiLogicAgentLoopStep;
      if (decision.action === 'stop') {
        this.logger.log('Agent mode logic stop signal received', {
          iteration,
          maxSteps,
          reason: decision.reason,
          generatedNodeCount: decision.result.nodes.length,
          generatedEdgeCount: decision.result.edges.length
        });

        const transformed = transformAiLogicOutput(
          decision.result,
          (message, meta) => this.logger.debug(message, meta)
        );

        this.logger.log('Agent mode logic transformation complete', {
          iteration,
          outputNodes: transformed.nodes.length,
          outputEdges: transformed.edges.length,
          summary: transformed.summary
        });

        this.logUsageSummary('logic-agent-loop', usageSummary);
        return transformed;
      }

      const normalizedNextPrompt = this.normalizeStepPrompt(decision.nextStepPrompt);
      if (!normalizedNextPrompt) {
        this.logger.error('Agent mode produced empty next-step prompt', {
          iteration,
          reason: decision.reason
        });
        throw new Error('Agent mode produced an empty next-step prompt.');
      }

      const dedupeKey = normalizedNextPrompt.toLowerCase();
      if (seenStepPrompts.has(dedupeKey)) {
        this.logger.error('Agent mode repeated next-step prompt', {
          iteration,
          maxSteps,
          reason: decision.reason,
          repeatedPrompt: normalizedNextPrompt,
          currentStepPromptPreview: currentStepPrompt.slice(0, 120),
          previousStepCount: previousStepPrompts.length,
          previousStepsTail: previousStepPrompts.slice(-5)
        });
        throw new Error('Agent mode repeated a previous step and cannot make progress.');
      }

      if (STEP_RECOMMENDATION_PATTERN.test(normalizedNextPrompt)) {
        this.logger.warn('Agent mode next-step prompt resembles recommendation language', {
          iteration,
          nextStepPrompt: normalizedNextPrompt
        });
      }

      this.logger.log('Agent mode logic continue signal received', {
        iteration,
        reason: decision.reason,
        nextStepPrompt: normalizedNextPrompt
      });

      seenStepPrompts.add(dedupeKey);
      previousStepPrompts.push(normalizedNextPrompt);
      currentStepPrompt = normalizedNextPrompt;
    }

    this.logUsageSummary('logic-agent-loop', usageSummary);
    this.logger.error('Agent mode logic reached max steps without stop', {
      maxSteps,
      finalStepPromptPreview: currentStepPrompt.slice(0, 120),
      previousStepCount: previousStepPrompts.length,
      previousStepsTail: previousStepPrompts.slice(-5)
    });
    throw new Error(`Agent mode reached max steps (${maxSteps}) without a stop signal.`);
  }

  private async generateUiWithAgentMode(
    adapter: LlmAdapter,
    goalPrompt: string,
    maxSteps: number
  ): Promise<TransformedUi> {
    const usageSummary = this.createUsageSummary();
    const seenStepPrompts = new Set<string>();
    const previousStepPrompts: string[] = [];

    let currentStepPrompt = goalPrompt;

    for (let iteration = 1; iteration <= maxSteps; iteration += 1) {
      this.logger.log('Agent mode UI iteration started', {
        iteration,
        maxSteps,
        currentPromptLength: currentStepPrompt.length,
        currentPromptPreview: currentStepPrompt.slice(0, 120),
        previousStepCount: previousStepPrompts.length
      });

      const response = await adapter.structuredCompletion({
        messages: this.buildAgentLoopMessages(
          UI_AGENT_LOOP_SYSTEM_PROMPT,
          UI_GENERATION_SYSTEM_PROMPT,
          goalPrompt,
          currentStepPrompt,
          previousStepPrompts,
          iteration,
          maxSteps
        ),
        schema: AiUiAgentLoopStepSchema,
        schemaName: 'ui_agent_loop_step'
      });

      this.recordUsage('ui-agent-loop', usageSummary, response.usage, {
        iteration,
        action: response.data.action
      });

      const decision = response.data as AiUiAgentLoopStep;
      if (decision.action === 'stop') {
        this.logger.log('Agent mode UI stop signal received', {
          iteration,
          maxSteps,
          reason: decision.reason,
          generatedSectionCount: decision.result.sections.length
        });

        const transformed = transformAiUiOutput(
          decision.result,
          (message, meta) => this.logger.debug(message, meta)
        );

        this.logger.log('Agent mode UI transformation complete', {
          iteration,
          contentItems: transformed.data.content.length,
          zoneCount: Object.keys(transformed.data.zones ?? {}).length,
          summary: transformed.summary
        });

        this.logUsageSummary('ui-agent-loop', usageSummary);
        return transformed;
      }

      const normalizedNextPrompt = this.normalizeStepPrompt(decision.nextStepPrompt);
      if (!normalizedNextPrompt) {
        this.logger.error('Agent mode produced empty UI next-step prompt', {
          iteration,
          reason: decision.reason
        });
        throw new Error('Agent mode produced an empty next-step prompt.');
      }

      const dedupeKey = normalizedNextPrompt.toLowerCase();
      if (seenStepPrompts.has(dedupeKey)) {
        this.logger.error('Agent mode repeated UI next-step prompt', {
          iteration,
          maxSteps,
          reason: decision.reason,
          repeatedPrompt: normalizedNextPrompt,
          currentStepPromptPreview: currentStepPrompt.slice(0, 120),
          previousStepCount: previousStepPrompts.length,
          previousStepsTail: previousStepPrompts.slice(-5)
        });
        throw new Error('Agent mode repeated a previous step and cannot make progress.');
      }

      if (STEP_RECOMMENDATION_PATTERN.test(normalizedNextPrompt)) {
        this.logger.warn('Agent mode UI next-step prompt resembles recommendation language', {
          iteration,
          nextStepPrompt: normalizedNextPrompt
        });
      }

      this.logger.log('Agent mode UI continue signal received', {
        iteration,
        reason: decision.reason,
        nextStepPrompt: normalizedNextPrompt
      });

      seenStepPrompts.add(dedupeKey);
      previousStepPrompts.push(normalizedNextPrompt);
      currentStepPrompt = normalizedNextPrompt;
    }

    this.logUsageSummary('ui-agent-loop', usageSummary);
    this.logger.error('Agent mode UI reached max steps without stop', {
      maxSteps,
      finalStepPromptPreview: currentStepPrompt.slice(0, 120),
      previousStepCount: previousStepPrompts.length,
      previousStepsTail: previousStepPrompts.slice(-5)
    });
    throw new Error(`Agent mode reached max steps (${maxSteps}) without a stop signal.`);
  }

  async generateLogic(prompt: string, options?: AiGenerationOptions): Promise<TransformedLogic> {
    const adapter = this.getAdapter();
    const sanitizedPrompt = this.ensurePrompt(prompt);
    const configuredLimit = this.resolveConfiguredAgentMaxSteps();
    const agentConfig = this.resolveAgentModeConfig(options);

    this.logger.log('Generating logic from prompt', {
      promptLength: sanitizedPrompt.length,
      promptPreview: sanitizedPrompt.slice(0, 100),
      agentMode: agentConfig.enabled,
      requestedAgentMaxSteps: options?.agentMaxSteps ?? null,
      configuredAgentMaxSteps: configuredLimit.value,
      configuredAgentMaxStepsSource: configuredLimit.source,
      effectiveAgentMaxSteps: agentConfig.maxSteps
    });

    if (agentConfig.enabled) {
      try {
        return await this.generateLogicWithAgentMode(adapter, sanitizedPrompt, agentConfig.maxSteps);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (!this.isRecoverableAgentLoopError(error)) {
          this.logger.error('Agent mode logic failed with non-recoverable error', {
            error: errorMessage,
            promptLength: sanitizedPrompt.length,
            promptPreview: sanitizedPrompt.slice(0, 100)
          });
          throw error;
        }

        this.logger.warn('Agent mode logic stalled; falling back to single-pass generation', {
          error: errorMessage,
          promptLength: sanitizedPrompt.length,
          promptPreview: sanitizedPrompt.slice(0, 100)
        });

        return this.generateLogicSinglePass(adapter, sanitizedPrompt, 'agent-fallback');
      }
    }

    return this.generateLogicSinglePass(adapter, sanitizedPrompt, 'standard');
  }

  async generateUi(prompt: string, options?: AiGenerationOptions): Promise<TransformedUi> {
    const adapter = this.getAdapter();
    const sanitizedPrompt = this.ensurePrompt(prompt);
    const configuredLimit = this.resolveConfiguredAgentMaxSteps();
    const agentConfig = this.resolveAgentModeConfig(options);

    this.logger.log('Generating UI from prompt', {
      promptLength: sanitizedPrompt.length,
      promptPreview: sanitizedPrompt.slice(0, 100),
      agentMode: agentConfig.enabled,
      requestedAgentMaxSteps: options?.agentMaxSteps ?? null,
      configuredAgentMaxSteps: configuredLimit.value,
      configuredAgentMaxStepsSource: configuredLimit.source,
      effectiveAgentMaxSteps: agentConfig.maxSteps
    });

    if (agentConfig.enabled) {
      try {
        return await this.generateUiWithAgentMode(adapter, sanitizedPrompt, agentConfig.maxSteps);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (!this.isRecoverableAgentLoopError(error)) {
          this.logger.error('Agent mode UI failed with non-recoverable error', {
            error: errorMessage,
            promptLength: sanitizedPrompt.length,
            promptPreview: sanitizedPrompt.slice(0, 100)
          });
          throw error;
        }

        this.logger.warn('Agent mode UI stalled; falling back to single-pass generation', {
          error: errorMessage,
          promptLength: sanitizedPrompt.length,
          promptPreview: sanitizedPrompt.slice(0, 100)
        });

        return this.generateUiSinglePass(adapter, sanitizedPrompt, 'agent-fallback');
      }
    }

    return this.generateUiSinglePass(adapter, sanitizedPrompt, 'standard');
  }

  async generateAgent(prompt: string, options?: AiGenerationOptions): Promise<AgentGenerationResult> {
    const adapter = this.getAdapter();
    const sanitizedPrompt = this.ensurePrompt(prompt);
    const configuredLimit = this.resolveConfiguredAgentMaxSteps();
    const agentConfig = this.resolveAgentModeConfig(options);
    const routingUsage = this.createUsageSummary();

    this.logger.log('Agent generation requested', {
      promptLength: sanitizedPrompt.length,
      promptPreview: sanitizedPrompt.slice(0, 100),
      agentMode: agentConfig.enabled,
      requestedAgentMaxSteps: options?.agentMaxSteps ?? null,
      configuredAgentMaxSteps: configuredLimit.value,
      configuredAgentMaxStepsSource: configuredLimit.source,
      effectiveAgentMaxSteps: agentConfig.maxSteps
    });

    const routingDecision = await this.decideAgentEditScope(adapter, sanitizedPrompt, routingUsage);

    let ui: TransformedUi | undefined;
    let logic: TransformedLogic | undefined;

    if (routingDecision.applyUi) {
      const uiPrompt = this.ensurePrompt(routingDecision.uiPrompt ?? sanitizedPrompt);
      this.logger.log('Agent generation dispatching UI edit task', {
        promptLength: uiPrompt.length,
        promptPreview: uiPrompt.slice(0, 100)
      });
      ui = await this.generateUi(uiPrompt, { agentMode: agentConfig.enabled });
      this.logger.log('Agent generation UI task completed', {
        contentItems: ui.data.content.length,
        zoneCount: Object.keys(ui.data.zones ?? {}).length,
        summary: ui.summary
      });
    }

    if (routingDecision.applyLogic) {
      const logicPrompt = this.ensurePrompt(routingDecision.logicPrompt ?? sanitizedPrompt);
      this.logger.log('Agent generation dispatching logic edit task', {
        promptLength: logicPrompt.length,
        promptPreview: logicPrompt.slice(0, 100)
      });
      logic = await this.generateLogic(logicPrompt, { agentMode: agentConfig.enabled });
      this.logger.log('Agent generation logic task completed', {
        nodeCount: logic.nodes.length,
        edgeCount: logic.edges.length,
        summary: logic.summary
      });
    }

    this.logUsageSummary('agent-edit-scope', routingUsage);

    if (!ui && !logic) {
      this.logger.error('Agent generation produced no outputs after routing', {
        applyUi: routingDecision.applyUi,
        applyLogic: routingDecision.applyLogic,
        reason: routingDecision.reason
      });
      throw new Error('Agent mode did not produce any edits.');
    }

    const summaryParts: string[] = [];
    if (ui) {
      summaryParts.push(`UI: ${ui.summary}`);
    }
    if (logic) {
      summaryParts.push(`Logic: ${logic.summary}`);
    }

    const summary = summaryParts.join(' | ');

    this.logger.log('Agent generation completed', {
      applyUi: Boolean(ui),
      applyLogic: Boolean(logic),
      routingReason: routingDecision.reason,
      summary
    });

    return {
      summary,
      routing: {
        applyUi: routingDecision.applyUi,
        applyLogic: routingDecision.applyLogic,
        reason: routingDecision.reason,
        ...(routingDecision.uiPrompt ? { uiPrompt: routingDecision.uiPrompt } : {}),
        ...(routingDecision.logicPrompt ? { logicPrompt: routingDecision.logicPrompt } : {})
      },
      ...(ui ? { ui } : {}),
      ...(logic ? { logic } : {})
    };
  }
}
