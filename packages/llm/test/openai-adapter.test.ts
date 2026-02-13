import { z } from 'zod';
import { OpenAIAdapter } from '../src/openai-adapter';
import { createLlmAdapter } from '../src/index';

// --- Mock the OpenAI SDK ---------------------------------------------------
const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } }
  }));
});

jest.mock('openai/helpers/zod', () => ({
  zodResponseFormat: jest.fn((_schema: unknown, name: string) => ({
    type: 'json_schema',
    json_schema: { name, strict: true }
  }))
}));

const testConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'test-key-123',
  model: 'gpt-4o',
  maxTokens: 1024,
  temperature: 0.1
};

describe('OpenAIAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set providerName from baseUrl hostname', () => {
    const adapter = new OpenAIAdapter(testConfig);
    expect(adapter.providerName).toContain('api.openai.com');
  });

  it('should return parsed data from a structuredCompletion call', async () => {
    const schema = z.object({ greeting: z.string() });
    const expected = { greeting: 'hello' };

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(expected) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    });

    const adapter = new OpenAIAdapter(testConfig);
    const result = await adapter.structuredCompletion({
      messages: [{ role: 'user', content: 'Say hello' }],
      schema,
      schemaName: 'test_schema'
    });

    expect(result.data).toEqual(expected);
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15
    });
  });

  it('should throw on empty response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }]
    });

    const adapter = new OpenAIAdapter(testConfig);
    const schema = z.object({ x: z.number() });

    await expect(
      adapter.structuredCompletion({
        messages: [{ role: 'user', content: 'test' }],
        schema,
        schemaName: 'test'
      })
    ).rejects.toThrow('Empty response');
  });

  it('should pass messages and response_format to the OpenAI client', async () => {
    const schema = z.object({ name: z.string() });

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ name: 'test' }) } }]
    });

    const adapter = new OpenAIAdapter(testConfig);
    await adapter.structuredCompletion({
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'What is your name?' }
      ],
      schema,
      schemaName: 'name_response'
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        max_tokens: 1024,
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'What is your name?' }
        ]
      })
    );
  });

  it('should handle missing usage gracefully', async () => {
    const schema = z.object({ ok: z.boolean() });

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ ok: true }) } }]
    });

    const adapter = new OpenAIAdapter(testConfig);
    const result = await adapter.structuredCompletion({
      messages: [{ role: 'user', content: 'test' }],
      schema,
      schemaName: 'test'
    });

    expect(result.data).toEqual({ ok: true });
    expect(result.usage).toBeUndefined();
  });

  it('should use default maxTokens and temperature when not provided', () => {
    const adapter = new OpenAIAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'key',
      model: 'gpt-4o'
    });
    expect(adapter.providerName).toContain('api.openai.com');
  });
});

describe('createLlmAdapter', () => {
  it('should return an OpenAIAdapter instance', () => {
    const adapter = createLlmAdapter(testConfig);
    expect(adapter.providerName).toContain('api.openai.com');
  });

  it('should work with OpenRouter base URL', () => {
    const adapter = createLlmAdapter({
      ...testConfig,
      baseUrl: 'https://openrouter.ai/api/v1'
    });
    expect(adapter.providerName).toContain('openrouter.ai');
  });

  it('should work with Groq base URL', () => {
    const adapter = createLlmAdapter({
      ...testConfig,
      baseUrl: 'https://api.groq.com/openai/v1'
    });
    expect(adapter.providerName).toContain('api.groq.com');
  });
});
