import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearModelCache,
  createEmbeddingModel,
  createEmbeddingModelFromConfig,
  createEmbeddingProvider,
  createLanguageModel,
  createLanguageModelFromConfig,
  testEmbeddingConnection,
  testLLMConnection,
} from "../src/provider.js";

vi.mock("ai", () => ({
  embed: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => {
  const createOpenAI = vi.fn().mockImplementation(() => {
    const chatFn = vi.fn().mockImplementation((model: string) => ({
      modelId: `openai-chat:${model}`,
    }));
    const embeddingFn = vi.fn().mockImplementation((model: string) => ({
      modelId: `openai-emb:${model}`,
    }));
    const modelFn = vi.fn().mockImplementation((model: string) => ({
      modelId: `openai-default:${model}`,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (modelFn as any).chat = chatFn;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (modelFn as any).embedding = embeddingFn;
    return modelFn;
  });
  return { createOpenAI };
});

vi.mock("@ai-sdk/anthropic", () => {
  const createAnthropic = vi.fn().mockImplementation(() =>
    vi.fn().mockImplementation((model: string) => ({
      modelId: `anthropic:${model}`,
    }))
  );
  return { createAnthropic };
});

vi.mock("@ai-sdk/google", () => {
  const createGoogleGenerativeAI = vi.fn().mockImplementation(() => {
    const modelFn = vi
      .fn()
      .mockImplementation((model: string) => ({ modelId: `google:${model}` }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (modelFn as any).embedding = vi
      .fn()
      .mockImplementation((model: string) => ({
        modelId: `google-emb:${model}`,
      }));
    return modelFn;
  });
  return { createGoogleGenerativeAI };
});

// settings 渡しを検証するためのモック createOpenAI
async function importMockedOpenAI() {
  return await import("@ai-sdk/openai");
}

describe("createLanguageModel", () => {
  beforeEach(() => {
    clearModelCache();
    vi.clearAllMocks();
  });

  it("openai プロバイダーは Chat Completions API (.chat) を呼び出すこと", () => {
    const model = createLanguageModel("openai", "gpt-4o", { apiKey: "key" });
    expect(model).toEqual({ modelId: "openai-chat:gpt-4o" });
  });

  it("同一設定で createLanguageModel を複数回呼んだ場合は同一インスタンスをキャッシュ再利用すること", async () => {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const model1 = createLanguageModel(
      "anthropic",
      "claude-3-5-sonnet-20241022",
      {
        apiKey: "key-1",
      }
    );
    const model2 = createLanguageModel(
      "anthropic",
      "claude-3-5-sonnet-20241022",
      {
        apiKey: "key-1",
      }
    );

    expect(model1).toBe(model2);
    // 初期化ファクトリは1回のみ呼ばれる
    expect(createAnthropic).toHaveBeenCalledTimes(1);
  });

  it("設定（モデル名やキー）が異なる場合は別インスタンスを生成すること", async () => {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const model1 = createLanguageModel(
      "anthropic",
      "claude-3-5-sonnet-20241022",
      {
        apiKey: "key-1",
      }
    );
    const model2 = createLanguageModel(
      "anthropic",
      "claude-3-5-haiku-20241022",
      {
        apiKey: "key-1",
      }
    );

    expect(createAnthropic).toHaveBeenCalledTimes(2);
    expect(model1).not.toBe(model2);
  });

  it("clearModelCache を呼ぶとキャッシュが破棄され次回呼び出し時に再生成されること", async () => {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    createLanguageModel("anthropic", "claude-3-5-sonnet-20241022", {
      apiKey: "key-1",
    });
    expect(createAnthropic).toHaveBeenCalledTimes(1);

    clearModelCache();

    createLanguageModel("anthropic", "claude-3-5-sonnet-20241022", {
      apiKey: "key-1",
    });
    expect(createAnthropic).toHaveBeenCalledTimes(2);
  });

  it("createEmbeddingModel も同一設定でインスタンスをキャッシュ再利用すること", async () => {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const emb1 = createEmbeddingModel("google", "text-embedding-004", {
      apiKey: "g-key",
    });
    const emb2 = createEmbeddingModel("google", "text-embedding-004", {
      apiKey: "g-key",
    });

    expect(emb1).toBe(emb2);
    expect(createGoogleGenerativeAI).toHaveBeenCalledTimes(1);
  });

  it("openai プロバイダーで baseURL がある場合も Chat Completions API (.chat) を呼び出すこと", () => {
    const model = createLanguageModel("openai", "glm-5.3-flash", {
      apiKey: "key",
      baseURL: "https://ollama.com/v1",
    });
    expect(model).toEqual({ modelId: "openai-chat:glm-5.3-flash" });
  });

  it("ollama プロバイダーの場合は Chat Completions API (.chat) を呼び出すこと", () => {
    const model = createLanguageModel("ollama", "llama3", {
      baseURL: "http://localhost:11434/v1",
    });
    expect(model).toEqual({ modelId: "openai-chat:llama3" });
  });

  it("custom_openai プロバイダーの場合は Chat Completions API (.chat) を呼び出すこと", () => {
    const model = createLanguageModel("custom_openai", "custom-model", {
      apiKey: "key",
      baseURL: "https://openrouter.ai/api/v1",
    });
    expect(model).toEqual({ modelId: "openai-chat:custom-model" });
  });

  it("anthropic プロバイダーの場合は createAnthropic を呼び出すこと", () => {
    const model = createLanguageModel(
      "anthropic",
      "claude-3-5-sonnet-20241022",
      { apiKey: "key" }
    );
    expect(model).toEqual({ modelId: "anthropic:claude-3-5-sonnet-20241022" });
  });

  it("google プロバイダーの場合は createGoogleGenerativeAI を呼び出すこと", () => {
    const model = createLanguageModel("google", "gemini-1.5-pro", {
      apiKey: "key",
    });
    expect(model).toEqual({ modelId: "google:gemini-1.5-pro" });
  });
});

describe("config / env フォールバック設定の解決", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createLanguageModelFromConfig はプロバイダが一致する LLM_* 環境変数へフォールバックすること", async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createLanguageModelFromConfig(
      { modelId: "gpt-4o", provider: "openai" },
      {
        LLM_API_KEY: "env-key",
        LLM_BASE_URL: "https://llm.example.com/v1",
        LLM_MODEL: "env-model",
        LLM_PROVIDER: "openai",
      }
    );
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
      apiKey: "env-key",
      baseURL: "https://llm.example.com/v1",
    });
  });

  it("createLanguageModelFromConfig はプロバイダが一致しない場合フォールバックしないこと", async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createLanguageModelFromConfig(
      { modelId: "claude-3", provider: "anthropic" },
      {
        LLM_API_KEY: "env-key",
        LLM_BASE_URL: "https://llm.example.com/v1",
        LLM_PROVIDER: "openai",
      }
    );
    expect(vi.mocked(createOpenAI)).not.toHaveBeenCalled();
  });

  it("createEmbeddingModelFromConfig はプロバイダが一致する EMBEDDING_* を優先すること", async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createEmbeddingModelFromConfig(
      { modelId: "text-embedding-3-small", provider: "openai" },
      {
        EMBEDDING_API_KEY: "emb-key",
        EMBEDDING_BASE_URL: "https://emb.example.com/v1",
        EMBEDDING_PROVIDER: "openai",
        LLM_API_KEY: "llm-key",
        LLM_BASE_URL: "https://llm.example.com/v1",
        LLM_PROVIDER: "openai",
      }
    );
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
      apiKey: "emb-key",
      baseURL: "https://emb.example.com/v1",
    });
  });

  it("createEmbeddingModelFromConfig は EMBEDDING_* が一致しない場合 LLM_* へフォールバックすること", async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createEmbeddingModelFromConfig(
      { modelId: "text-embedding-3-small", provider: "openai" },
      {
        EMBEDDING_API_KEY: "emb-key",
        EMBEDDING_BASE_URL: "https://emb.example.com/v1",
        EMBEDDING_PROVIDER: "google",
        LLM_API_KEY: "llm-key",
        LLM_BASE_URL: "https://llm.example.com/v1",
        LLM_PROVIDER: "openai",
      }
    );
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
      apiKey: "llm-key",
      baseURL: "https://llm.example.com/v1",
    });
  });
});

describe("createEmbeddingProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("EMBEDDING_BASE_URL が設定されている場合はそれを優先すること", async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createEmbeddingProvider({
      EMBEDDING_API_KEY: "emb-key",
      EMBEDDING_BASE_URL: "https://emb.example.com/v1",
      EMBEDDING_MODEL: "emb-model",
      EMBEDDING_PROVIDER: "openai",
      LLM_API_KEY: "llm-key",
      LLM_BASE_URL: "https://llm.example.com/v1",
      LLM_MODEL: "llm-model",
      LLM_PROVIDER: "openai",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
      apiKey: "emb-key",
      baseURL: "https://emb.example.com/v1",
    });
  });

  it("EMBEDDING_BASE_URL が未設定の場合は LLM_BASE_URL にフォールバックすること", async () => {
    const { createOpenAI } = await importMockedOpenAI();
    createEmbeddingProvider({
      EMBEDDING_API_KEY: "emb-key",
      EMBEDDING_MODEL: "emb-model",
      EMBEDDING_PROVIDER: "openai",
      LLM_API_KEY: "llm-key",
      LLM_BASE_URL: "https://llm.example.com/v1",
      LLM_MODEL: "llm-model",
      LLM_PROVIDER: "openai",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(vi.mocked(createOpenAI)).toHaveBeenCalledWith({
      apiKey: "emb-key",
      baseURL: "https://llm.example.com/v1",
    });
  });
});

describe("testLLMConnection / testEmbeddingConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("testLLMConnection は接続成功時に success と latencyMs を返すこと", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockResolvedValue({ text: "pong!!" } as never);

    const result = await testLLMConnection({
      modelId: "gpt-4o",
      provider: "openai",
    });

    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message).toBe("接続成功: pong!!");
    expect(result.error).toBeUndefined();
  });

  it("testLLMConnection は失敗時に success: false とエラーメッセージを返すこと", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockRejectedValue(new Error("boom"));

    const result = await testLLMConnection({
      modelId: "gpt-4o",
      provider: "openai",
    });

    expect(result.success).toBe(false);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message).toBe("接続失敗: boom");
    expect(result.error).toBe("boom");
  });

  it("testEmbeddingConnection は検出次元数を含むメッセージを返すこと", async () => {
    const { embed } = await import("ai");
    vi.mocked(embed).mockResolvedValue({ embedding: [0.1, 0.2, 0.3] } as never);

    const result = await testEmbeddingConnection({
      modelId: "text-embedding-3-small",
      provider: "openai",
    });

    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message).toBe("接続成功 (検出次元数: 3)");
    expect(result.error).toBeUndefined();
  });

  it("testEmbeddingConnection は失敗時に success: false とエラーメッセージを返すこと", async () => {
    const { embed } = await import("ai");
    vi.mocked(embed).mockRejectedValue(new Error("emb boom"));

    const result = await testEmbeddingConnection({
      modelId: "text-embedding-3-small",
      provider: "openai",
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("接続失敗: emb boom");
    expect(result.error).toBe("emb boom");
  });
});
