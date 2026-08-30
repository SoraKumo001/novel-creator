import { describe, expect, it, vi } from 'vitest';
import { createLanguageModel } from '../src/provider.js';

vi.mock('@ai-sdk/openai', () => {
  const chatFn = vi.fn().mockReturnValue({ modelId: 'mock-openai-chat' });
  const modelFn = vi.fn().mockReturnValue({ modelId: 'mock-openai-default' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (modelFn as any).chat = chatFn;
  const createOpenAI = vi.fn().mockReturnValue(modelFn);
  return { createOpenAI };
});

vi.mock('@ai-sdk/anthropic', () => {
  const modelFn = vi.fn().mockReturnValue({ modelId: 'mock-anthropic' });
  const createAnthropic = vi.fn().mockReturnValue(modelFn);
  return { createAnthropic };
});

vi.mock('@ai-sdk/google', () => {
  const modelFn = vi.fn().mockReturnValue({ modelId: 'mock-google' });
  const createGoogleGenerativeAI = vi.fn().mockReturnValue(modelFn);
  return { createGoogleGenerativeAI };
});

describe('createLanguageModel', () => {
  it('openai プロバイダーは Chat Completions API (.chat) を呼び出すこと', () => {
    const model = createLanguageModel('openai', 'gpt-4o', { apiKey: 'key' });
    expect(model).toEqual({ modelId: 'mock-openai-chat' });
  });

  it('openai プロバイダーで baseURL がある場合も Chat Completions API (.chat) を呼び出すこと', () => {
    const model = createLanguageModel('openai', 'glm-5.3-flash', {
      apiKey: 'key',
      baseURL: 'https://ollama.com/v1',
    });
    expect(model).toEqual({ modelId: 'mock-openai-chat' });
  });

  it('ollama プロバイダーの場合は Chat Completions API (.chat) を呼び出すこと', () => {
    const model = createLanguageModel('ollama', 'llama3', {
      baseURL: 'http://localhost:11434/v1',
    });
    expect(model).toEqual({ modelId: 'mock-openai-chat' });
  });

  it('custom_openai プロバイダーの場合は Chat Completions API (.chat) を呼び出すこと', () => {
    const model = createLanguageModel('custom_openai', 'custom-model', {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: 'key',
    });
    expect(model).toEqual({ modelId: 'mock-openai-chat' });
  });

  it('anthropic プロバイダーの場合は createAnthropic を呼び出すこと', () => {
    const model = createLanguageModel('anthropic', 'claude-3-5-sonnet-20241022', { apiKey: 'key' });
    expect(model).toEqual({ modelId: 'mock-anthropic' });
  });

  it('google プロバイダーの場合は createGoogleGenerativeAI を呼び出すこと', () => {
    const model = createLanguageModel('google', 'gemini-1.5-pro', { apiKey: 'key' });
    expect(model).toEqual({ modelId: 'mock-google' });
  });
});
