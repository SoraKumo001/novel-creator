import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmbeddingModelFromConfig,
  createEmbeddingProvider,
  createLanguageModel,
  createLanguageModelFromConfig,
  testEmbeddingConnection,
  testLLMConnection,
} from '../src/provider.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  embed: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => {
  const chatFn = vi.fn().mockReturnValue({ modelId: 'mock-openai-chat' });
  const embeddingFn = vi.fn().mockReturnValue({ modelId: 'mock-openai-embedding' });
  const modelFn = vi.fn().mockReturnValue({ modelId: 'mock-openai-default' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (modelFn as any).chat = chatFn;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (modelFn as any).embedding = embeddingFn;
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

// settings 渡しを検証するためのモック createOpenAI
async function importMockedOpenAI() {
  return await import('@ai-sdk/openai');
}

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

describe('config / env フォールバック設定の解決', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createLanguageModelFromConfig はプロバイダが一致する LLM_* 環境変数へフォールバックすること', async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createLanguageModelFromConfig(
      { provider: 'openai', modelId: 'gpt-4o' },
      {
        LLM_PROVIDER: 'openai',
        LLM_MODEL: 'env-model',
        LLM_API_KEY: 'env-key',
        LLM_BASE_URL: 'https://llm.example.com/v1',
      },
    );
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
      apiKey: 'env-key',
      baseURL: 'https://llm.example.com/v1',
    });
  });

  it('createLanguageModelFromConfig はプロバイダが一致しない場合フォールバックしないこと', async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createLanguageModelFromConfig(
      { provider: 'anthropic', modelId: 'claude-3' },
      {
        LLM_PROVIDER: 'openai',
        LLM_API_KEY: 'env-key',
        LLM_BASE_URL: 'https://llm.example.com/v1',
      },
    );
    expect(vi.mocked(createOpenAI)).not.toHaveBeenCalled();
  });

  it('createEmbeddingModelFromConfig はプロバイダが一致する EMBEDDING_* を優先すること', async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createEmbeddingModelFromConfig(
      { provider: 'openai', modelId: 'text-embedding-3-small' },
      {
        LLM_PROVIDER: 'openai',
        LLM_API_KEY: 'llm-key',
        LLM_BASE_URL: 'https://llm.example.com/v1',
        EMBEDDING_PROVIDER: 'openai',
        EMBEDDING_API_KEY: 'emb-key',
        EMBEDDING_BASE_URL: 'https://emb.example.com/v1',
      },
    );
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
      apiKey: 'emb-key',
      baseURL: 'https://emb.example.com/v1',
    });
  });

  it('createEmbeddingModelFromConfig は EMBEDDING_* が一致しない場合 LLM_* へフォールバックすること', async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createEmbeddingModelFromConfig(
      { provider: 'openai', modelId: 'text-embedding-3-small' },
      {
        LLM_PROVIDER: 'openai',
        LLM_API_KEY: 'llm-key',
        LLM_BASE_URL: 'https://llm.example.com/v1',
        EMBEDDING_PROVIDER: 'google',
        EMBEDDING_API_KEY: 'emb-key',
        EMBEDDING_BASE_URL: 'https://emb.example.com/v1',
      },
    );
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
      apiKey: 'llm-key',
      baseURL: 'https://llm.example.com/v1',
    });
  });
});

describe('createEmbeddingProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('EMBEDDING_BASE_URL が設定されている場合はそれを優先すること', async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createEmbeddingProvider({
      LLM_PROVIDER: 'openai',
      LLM_MODEL: 'llm-model',
      LLM_API_KEY: 'llm-key',
      LLM_BASE_URL: 'https://llm.example.com/v1',
      EMBEDDING_PROVIDER: 'openai',
      EMBEDDING_MODEL: 'emb-model',
      EMBEDDING_API_KEY: 'emb-key',
      EMBEDDING_BASE_URL: 'https://emb.example.com/v1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
      apiKey: 'emb-key',
      baseURL: 'https://emb.example.com/v1',
    });
  });

  it('EMBEDDING_BASE_URL が未設定の場合は LLM_BASE_URL にフォールバックすること', async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createEmbeddingProvider({
      LLM_PROVIDER: 'openai',
      LLM_MODEL: 'llm-model',
      LLM_API_KEY: 'llm-key',
      LLM_BASE_URL: 'https://llm.example.com/v1',
      EMBEDDING_PROVIDER: 'openai',
      EMBEDDING_MODEL: 'emb-model',
      EMBEDDING_API_KEY: 'emb-key',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
      apiKey: 'emb-key',
      baseURL: 'https://llm.example.com/v1',
    });
  });
});

describe('testLLMConnection / testEmbeddingConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('testLLMConnection は接続成功時に success と latencyMs を返すこと', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({ text: 'pong!!' } as never);

    const result = await testLLMConnection({ provider: 'openai', modelId: 'gpt-4o' });

    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message).toBe('接続成功: pong!!');
    expect(result.error).toBeUndefined();
  });

  it('testLLMConnection は失敗時に success: false とエラーメッセージを返すこと', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockRejectedValue(new Error('boom'));

    const result = await testLLMConnection({ provider: 'openai', modelId: 'gpt-4o' });

    expect(result.success).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message).toBe('接続失敗: boom');
    expect(result.error).toBe('boom');
  });

  it('testEmbeddingConnection は検出次元数を含むメッセージを返すこと', async () => {
    const { embed } = await import('ai');
    vi.mocked(embed).mockResolvedValue({ embedding: [0.1, 0.2, 0.3] } as never);

    const result = await testEmbeddingConnection({
      provider: 'openai',
      modelId: 'text-embedding-3-small',
    });

    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message).toBe('接続成功 (検出次元数: 3)');
    expect(result.error).toBeUndefined();
  });

  it('testEmbeddingConnection は失敗時に success: false とエラーメッセージを返すこと', async () => {
    const { embed } = await import('ai');
    vi.mocked(embed).mockRejectedValue(new Error('emb boom'));

    const result = await testEmbeddingConnection({
      provider: 'openai',
      modelId: 'text-embedding-3-small',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe('接続失敗: emb boom');
    expect(result.error).toBe('emb boom');
  });
});
