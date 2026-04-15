import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProjectAiService } from '../src/projects/ai/ai.service';

// Mock the entire @buildweaver/llm module
const mockStructuredCompletion = jest.fn();

jest.mock('@buildweaver/llm', () => {
  const actual = jest.requireActual('@buildweaver/llm');
  return {
    ...actual,
    LlmProviderManager: jest.fn().mockImplementation(() => ({
      providerName: 'multi-provider(OPENAI)',
      structuredCompletion: mockStructuredCompletion
    })),
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
  };
});

function createConfigGet(overrides: Record<string, string | undefined> = {}) {
  const env: Record<string, string | undefined> = {
    PROVIDER_LIST: 'OPENAI',
    LLM_COOLDOWN_PERIOD: '300',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL: 'gpt-4o',
    OPENAI_ADAPTER: 'OPENAI',
    ...overrides
  };
  return jest.fn((key: string) => env[key]);
}

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
          useValue: { get: createConfigGet() }
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

  it('should throw when PROVIDER_LIST is missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAiService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) }
        }
      ]
    }).compile();

    const unconfiguredService = module.get(ProjectAiService);

    await expect(unconfiguredService.generateLogic('test')).rejects.toThrow(
      'LLM is not configured'
    );
  });

  it('should throw when a provider config is incomplete', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAiService,
        {
          provide: ConfigService,
          useValue: {
            get: createConfigGet({ OPENAI_API_KEY: undefined })
          }
        }
      ]
    }).compile();

    const svc = module.get(ProjectAiService);

    await expect(svc.generateLogic('test')).rejects.toThrow(
      'Provider OPENAI is missing required env vars'
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

  it('should parse multiple providers from PROVIDER_LIST', async () => {
    const { LlmProviderManager } = jest.requireMock('@buildweaver/llm') as {
      LlmProviderManager: jest.Mock;
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAiService,
        {
          provide: ConfigService,
          useValue: {
            get: createConfigGet({
              PROVIDER_LIST: 'OPENAI,GROQ',
              GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
              GROQ_API_KEY: 'groq-key',
              GROQ_MODEL: 'llama-3',
              GROQ_ADAPTER: 'OPENAI'
            })
          }
        }
      ]
    }).compile();

    const svc = module.get(ProjectAiService);

    mockStructuredCompletion.mockResolvedValueOnce({
      data: { nodes: [], edges: [], summary: 'ok' }
    });

    await svc.generateLogic('test');

    expect(LlmProviderManager).toHaveBeenCalledWith(
      expect.objectContaining({
        providers: expect.arrayContaining([
          expect.objectContaining({ name: 'OPENAI' }),
          expect.objectContaining({ name: 'GROQ' })
        ]),
        cooldownPeriodSeconds: 300
      })
    );
  });
});
