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
});
