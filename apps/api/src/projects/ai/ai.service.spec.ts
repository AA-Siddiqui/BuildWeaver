import { ConfigService } from '@nestjs/config';
import { AI_DEFAULT_STYLE } from '@buildweaver/llm';
import { ProjectAiService } from './ai.service';

const S = AI_DEFAULT_STYLE;

// --- Mock the @buildweaver/llm module ---
const mockStructuredCompletion = jest.fn();

jest.mock('@buildweaver/llm', () => {
  const actual = jest.requireActual('@buildweaver/llm');
  return {
    ...actual,
    LlmProviderManager: jest.fn().mockImplementation(() => ({
      providerName: 'test-provider',
      structuredCompletion: mockStructuredCompletion
    }))
  };
});

const makeConfigService = (overrides: Record<string, string> = {}): ConfigService => {
  const defaults: Record<string, string> = {
    PROVIDER_LIST: 'OPENAI',
    LLM_COOLDOWN_PERIOD: '60',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL: 'gpt-4o',
    OPENAI_ADAPTER: 'OPENAI'
  };
  const merged = { ...defaults, ...overrides };
  return {
    get: jest.fn((key: string) => merged[key])
  } as unknown as ConfigService;
};

describe('ProjectAiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUi', () => {
    it('should return transformed UI data on success', async () => {
      const aiResponse = {
        data: {
          sections: [
            {
              type: 'Section',
              backgroundColor: '#FFFFFF',
              style: S,
              children: [
                { type: 'Heading', content: 'Hello', size: 'h1', style: S }
              ]
            }
          ],
          summary: 'A simple heading page'
        },
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      };
      mockStructuredCompletion.mockResolvedValueOnce(aiResponse);

      const service = new ProjectAiService(makeConfigService());
      const result = await service.generateUi('Create a landing page');

      expect(result.summary).toBe('A simple heading page');
      expect(result.data).toBeDefined();
      expect(result.data.content).toHaveLength(1);
      expect(result.data.content[0].type).toBe('Section');
      expect(result.data.root).toEqual({ id: 'root', props: {}, children: [] });
    });

    it('should call structuredCompletion with ui_generation schema', async () => {
      const aiResponse = {
        data: {
          sections: [
            {
              type: 'Section',
              backgroundColor: '#FFFFFF',
              style: S,
              children: [{ type: 'Paragraph', content: 'Test', style: S }]
            }
          ],
          summary: 'Test page'
        }
      };
      mockStructuredCompletion.mockResolvedValueOnce(aiResponse);

      const service = new ProjectAiService(makeConfigService());
      await service.generateUi('Build a test page');

      expect(mockStructuredCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaName: 'ui_generation',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: 'Build a test page' })
          ])
        })
      );
    });

    it('should trim the prompt before sending', async () => {
      const aiResponse = {
        data: {
          sections: [
            {
              type: 'Section',
              backgroundColor: '#FFFFFF',
              style: S,
              children: [{ type: 'Heading', content: 'Trimmed', size: 'h1', style: S }]
            }
          ],
          summary: 'Trimmed'
        }
      };
      mockStructuredCompletion.mockResolvedValueOnce(aiResponse);

      const service = new ProjectAiService(makeConfigService());
      await service.generateUi('  Build a page  ');

      expect(mockStructuredCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'Build a page' })
          ])
        })
      );
    });

    it('should throw when LLM provider fails', async () => {
      mockStructuredCompletion.mockRejectedValueOnce(new Error('All LLM providers failed'));

      const service = new ProjectAiService(makeConfigService());
      await expect(service.generateUi('test')).rejects.toThrow('All LLM providers failed');
    });

    it('should throw when PROVIDER_LIST is not set', async () => {
      const configService = {
        get: jest.fn(() => undefined)
      } as unknown as ConfigService;

      const service = new ProjectAiService(configService);
      await expect(service.generateUi('test')).rejects.toThrow('LLM is not configured');
    });

    it('should generate zones for section children', async () => {
      const aiResponse = {
        data: {
          sections: [
            {
              type: 'Section',
              backgroundColor: '#FFFFFF',
              style: S,
              children: [
                { type: 'Heading', content: 'Title', size: 'h1', style: S },
                { type: 'Paragraph', content: 'Body', style: S }
              ]
            }
          ],
          summary: 'With children'
        }
      };
      mockStructuredCompletion.mockResolvedValueOnce(aiResponse);

      const service = new ProjectAiService(makeConfigService());
      const result = await service.generateUi('test');

      expect(result.data.zones).toBeDefined();
      const zoneKeys = Object.keys(result.data.zones!);
      expect(zoneKeys).toHaveLength(1);
      const sectionZone = result.data.zones![zoneKeys[0]];
      expect(sectionZone).toHaveLength(2);
      expect(sectionZone[0].type).toBe('Heading');
      expect(sectionZone[1].type).toBe('Paragraph');
    });

    it('should strip empty-string sentinel values from transformed output', async () => {
      const aiResponse = {
        data: {
          sections: [
            {
              type: 'Section',
              backgroundColor: '#FFFFFF',
              style: S,
              children: [
                { type: 'Button', label: 'Click', variant: 'primary', href: '', style: S },
                {
                  type: 'Card',
                  heading: 'Card',
                  content: 'Text',
                  eyebrow: '',
                  imageUrl: '',
                  actionLabel: '',
                  actionHref: '',
                  style: S
                }
              ]
            }
          ],
          summary: 'Sentinel test'
        }
      };
      mockStructuredCompletion.mockResolvedValueOnce(aiResponse);

      const service = new ProjectAiService(makeConfigService());
      const result = await service.generateUi('test');

      const zoneKeys = Object.keys(result.data.zones!);
      const children = result.data.zones![zoneKeys[0]];

      // Button href should be stripped (empty string sentinel)
      expect(children[0].props.href).toBeUndefined();

      // Card empty sentinel fields should be stripped
      expect(children[1].props.eyebrow).toBeUndefined();
      expect(children[1].props.imageUrl).toBeUndefined();
      expect(children[1].props.actionLabel).toBeUndefined();
      expect(children[1].props.actionHref).toBeUndefined();
    });
  });

  describe('agent mode', () => {
    it('should iterate logic steps until stop signal', async () => {
      mockStructuredCompletion
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Create arithmetic nodes for subtotal and tax.',
            reason: 'Need one decomposition step before final graph output.'
          },
          usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 }
        })
        .mockResolvedValueOnce({
          data: {
            action: 'stop',
            reason: 'Graph is complete.',
            result: {
              nodes: [
                {
                  kind: 'dummy',
                  tempId: 'n1',
                  label: 'Subtotal',
                  sampleType: 'decimal',
                  sampleValue: 100
                },
                {
                  kind: 'dummy',
                  tempId: 'n2',
                  label: 'Tax',
                  sampleType: 'decimal',
                  sampleValue: 0.2
                },
                {
                  kind: 'arithmetic',
                  tempId: 'n3',
                  label: 'Multiply',
                  operation: 'multiply',
                  operands: [{ label: 'A' }, { label: 'B' }]
                }
              ],
              edges: [
                { fromNode: 'n1', toNode: 'n3', toSlot: 0 },
                { fromNode: 'n2', toNode: 'n3', toSlot: 1 }
              ],
              summary: 'Calculates tax amount.'
            }
          },
          usage: { promptTokens: 20, completionTokens: 15, totalTokens: 35 }
        });

      const service = new ProjectAiService(makeConfigService());
      const result = await service.generateLogic('Build checkout logic', {
        agentMode: true
      });

      expect(mockStructuredCompletion).toHaveBeenCalledTimes(2);
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ schemaName: 'logic_agent_loop_step' })
      );
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ schemaName: 'logic_agent_loop_step' })
      );
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.summary).toBe('Calculates tax amount.');
    });

    it('should fallback when agent mode reaches max steps without stop', async () => {
      mockStructuredCompletion
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Create input node A.',
            reason: 'Still in progress.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Create input node B.',
            reason: 'Still in progress.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            nodes: [
              {
                kind: 'dummy',
                tempId: 'fallback-1',
                label: 'Fallback input',
                sampleType: 'decimal',
                sampleValue: 42
              }
            ],
            edges: [],
            summary: 'Recovered with single-pass fallback.'
          }
        });

      const service = new ProjectAiService(makeConfigService({ AI_AGENT_MAX_STEPS: '2' }));

      const result = await service.generateLogic('Build checkout logic', { agentMode: true });

      expect(result.summary).toBe('Recovered with single-pass fallback.');
      expect(mockStructuredCompletion).toHaveBeenCalledTimes(3);
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ schemaName: 'logic_generation' })
      );
    });

    it('should fallback when agent mode repeats a step prompt', async () => {
      mockStructuredCompletion
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Create conditional branch for premium users.',
            reason: 'Need branch setup.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Create conditional branch for premium users.',
            reason: 'Need branch setup.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            nodes: [
              {
                kind: 'dummy',
                tempId: 'fallback-repeat',
                label: 'Recovered node',
                sampleType: 'decimal',
                sampleValue: 1
              }
            ],
            edges: [],
            summary: 'Recovered after repeated step via single-pass fallback.'
          }
        });

      const service = new ProjectAiService(makeConfigService());

      const result = await service.generateLogic('Build membership logic', { agentMode: true });

      expect(result.summary).toBe('Recovered after repeated step via single-pass fallback.');
      expect(mockStructuredCompletion).toHaveBeenCalledTimes(3);
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ schemaName: 'logic_generation' })
      );
    });

    it('should transform UI output when agent mode stops', async () => {
      mockStructuredCompletion.mockResolvedValueOnce({
        data: {
          action: 'stop',
          reason: 'UI is complete.',
          result: {
            sections: [
              {
                type: 'Section',
                backgroundColor: '#FFFFFF',
                style: S,
                children: [{ type: 'Heading', content: 'Hello', size: 'h1', style: S }]
              }
            ],
            summary: 'Simple hero page'
          }
        },
        usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 }
      });

      const service = new ProjectAiService(makeConfigService());
      const result = await service.generateUi('Build a hero page', {
        agentMode: true
      });

      expect(mockStructuredCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ schemaName: 'ui_agent_loop_step' })
      );
      expect(result.summary).toBe('Simple hero page');
      expect(result.data.content).toHaveLength(1);
    });

    it('should fallback when UI agent mode repeats a step prompt', async () => {
      mockStructuredCompletion
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Build the hero section first.',
            reason: 'Start with above-the-fold content.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Build the hero section first.',
            reason: 'Start with above-the-fold content.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            sections: [
              {
                type: 'Section',
                backgroundColor: '#FFFFFF',
                style: S,
                children: [{ type: 'Heading', content: 'Recovered UI', size: 'h1', style: S }]
              }
            ],
            summary: 'Recovered UI fallback output.'
          }
        });

      const service = new ProjectAiService(makeConfigService());
      const result = await service.generateUi('Build a hero page', {
        agentMode: true
      });

      expect(result.summary).toBe('Recovered UI fallback output.');
      expect(mockStructuredCompletion).toHaveBeenCalledTimes(3);
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ schemaName: 'ui_generation' })
      );
    });

    it('should ignore request max steps, enforce hard limit, then fallback', async () => {
      mockStructuredCompletion
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Create input node A.',
            reason: 'Still in progress.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Create input node B.',
            reason: 'Still in progress.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            nodes: [
              {
                kind: 'dummy',
                tempId: 'fallback-hard-limit',
                label: 'Recovered with hard-limit fallback',
                sampleType: 'decimal',
                sampleValue: 7
              }
            ],
            edges: [],
            summary: 'Recovered after hard-limit enforcement.'
          }
        });

      const service = new ProjectAiService(makeConfigService({ AI_AGENT_MAX_STEPS: '2' }));

      const result = await service.generateLogic('Build checkout logic', {
        agentMode: true,
        agentMaxSteps: 8
      });

      expect(result.summary).toBe('Recovered after hard-limit enforcement.');
      expect(mockStructuredCompletion).toHaveBeenCalledTimes(3);
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ schemaName: 'logic_agent_loop_step' })
      );
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ schemaName: 'logic_agent_loop_step' })
      );
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ schemaName: 'logic_generation' })
      );
    });

    it('should recover in generateAgent when routed logic steps repeat', async () => {
      mockStructuredCompletion
        .mockResolvedValueOnce({
          data: {
            applyUi: false,
            applyLogic: true,
            reason: 'Prompt requests logic updates.',
            logicPrompt: 'Generate validation logic for checkout.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Create conditional branch for premium users.',
            reason: 'Need branch setup.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            action: 'continue',
            nextStepPrompt: 'Create conditional branch for premium users.',
            reason: 'Need branch setup.'
          }
        })
        .mockResolvedValueOnce({
          data: {
            nodes: [
              {
                kind: 'dummy',
                tempId: 'agent-fallback-1',
                label: 'Recovered node',
                sampleType: 'decimal',
                sampleValue: 5
              }
            ],
            edges: [],
            summary: 'Recovered agent logic fallback output.'
          }
        });

      const service = new ProjectAiService(makeConfigService());
      const result = await service.generateAgent('Add checkout validation logic', {
        agentMode: true
      });

      expect(result.routing.applyLogic).toBe(true);
      expect(result.logic?.summary).toBe('Recovered agent logic fallback output.');
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ schemaName: 'agent_edit_scope' })
      );
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ schemaName: 'logic_agent_loop_step' })
      );
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ schemaName: 'logic_agent_loop_step' })
      );
      expect(mockStructuredCompletion).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({ schemaName: 'logic_generation' })
      );
    });
  });
});
