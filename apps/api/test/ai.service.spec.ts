import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProjectAiService } from '../src/projects/ai/ai.service';

// Mock the entire @buildweaver/llm module
const mockStructuredCompletion = jest.fn();

jest.mock('@buildweaver/llm', () => ({
  createLlmAdapter: jest.fn(() => ({
    providerName: 'openai-compat(api.openai.com)',
    structuredCompletion: mockStructuredCompletion
  })),
  AiLogicGenerationResultSchema: {},
  LOGIC_GENERATION_SYSTEM_PROMPT: 'mock system prompt',
  transformAiLogicOutput: jest.fn((data: unknown) => {
    const d = data as { nodes: unknown[]; edges: unknown[]; summary: string };
    return {
      nodes: d.nodes.map((n: unknown, i: number) => ({
        id: `mock-node-${i}`,
        type: (n as { kind: string }).kind,
        position: { x: i * 300, y: 0 },
        data: n
      })),
      edges: [],
      summary: d.summary
    };
  })
}));

describe('ProjectAiService', () => {
  let service: ProjectAiService;
  let configService: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const env: Record<string, string> = {
                LLM_BASE_URL: 'https://api.openai.com/v1',
                LLM_API_KEY: 'test-key',
                LLM_MODEL: 'gpt-4o'
              };
              return env[key];
            })
          }
        }
      ]
    }).compile();

    service = module.get(ProjectAiService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate logic from a prompt', async () => {
    const mockLlmResult = {
      data: {
        nodes: [
          { kind: 'arithmetic', tempId: 'n1', label: 'Add', operation: 'add' }
        ],
        edges: [],
        summary: 'Addition node'
      },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
    };

    mockStructuredCompletion.mockResolvedValueOnce(mockLlmResult);

    const result = await service.generateLogic('Add two numbers');

    expect(result.nodes).toHaveLength(1);
    expect(result.summary).toBe('Addition node');
    expect(mockStructuredCompletion).toHaveBeenCalledTimes(1);
    expect(mockStructuredCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'Add two numbers' })
        ]),
        schemaName: 'logic_generation'
      })
    );
  });

  it('should throw when LLM configuration is missing', async () => {
    // Override config to return undefined
    jest.spyOn(configService, 'get').mockReturnValue(undefined);

    // Reset the cached adapter by creating a new service
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined)
          }
        }
      ]
    }).compile();

    const unconfiguredService = module.get(ProjectAiService);

    await expect(unconfiguredService.generateLogic('test')).rejects.toThrow(
      'LLM is not configured'
    );
  });

  it('should trim the prompt before sending', async () => {
    mockStructuredCompletion.mockResolvedValueOnce({
      data: {
        nodes: [{ kind: 'dummy', tempId: 'n1', label: 'X' }],
        edges: [],
        summary: 'Test'
      }
    });

    await service.generateLogic('  some prompt  ');

    expect(mockStructuredCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'some prompt' })
        ])
      })
    );
  });
});
