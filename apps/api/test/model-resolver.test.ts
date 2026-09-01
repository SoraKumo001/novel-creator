import { beforeEach, describe, expect, it, vi } from "vitest";

// drizzle-orm の eq をマーカーオブジェクトに差し替え、モック DB 側で
// 「ID 検索か is_default 検索か」を確実に判別できるようにする。
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((column: unknown, value: unknown) => ({
      __eqMarker: true,
      column,
      value,
    })),
  };
});

// create*ModelFromConfig をスパイし、どの設定からモデルが生成されたかを判別できるようにする。
vi.mock("@novel-creator/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@novel-creator/llm")>();
  return {
    ...actual,
    createEmbeddingModelFromConfig: vi.fn((config: { id?: string }) => ({
      __mock: "embedding-from-config",
      configId: config.id,
    })),
    createLanguageModelFromConfig: vi.fn((config: { id?: string }) => ({
      __mock: "llm-from-config",
      configId: config.id,
    })),
  };
});

import { embeddingConfigs, llmConfigs } from "@novel-creator/db";
import { createLanguageModelFromConfig } from "@novel-creator/llm";

import { EmbeddingConfigDomainService } from "../src/core/embedding-config.service.js";
import { LlmConfigDomainService } from "../src/core/llm-config.service.js";
import {
  resolveEmbeddingModel,
  resolveLLMModel,
} from "../src/core/model-resolver.js";
import { NotFoundError, type ServiceContext } from "../src/core/types.js";

const mockedCreateLLM = vi.mocked(createLanguageModelFromConfig);

type ConfigRow = Record<string, unknown>;

const customConfig: ConfigRow = {
  id: "cfg-custom",
  isDefault: false,
  modelId: "gpt-custom",
  name: "カスタム設定",
  provider: "openai",
};
const defaultConfig: ConfigRow = {
  id: "cfg-default",
  isDefault: true,
  modelId: "gpt-default",
  name: "デフォルト設定",
  provider: "openai",
};
const customEmbedding: ConfigRow = {
  dimensions: 768,
  id: "emb-custom",
  isDefault: false,
  modelId: "embedding-custom",
  name: "カスタム埋め込み",
  provider: "openai",
};
const defaultEmbedding: ConfigRow = {
  dimensions: 1024,
  id: "emb-default",
  isDefault: true,
  modelId: "embedding-default",
  name: "デフォルト埋め込み",
  provider: "openai",
};

/**
 * model-resolver が使う DB チェーン（select → from → where）をモックする。
 * where には vi.mock した eq のマーカーオブジェクトが渡されるため、
 * value === true の呼び出しをデフォルト設定検索、それ以外を ID 検索として振り分ける。
 */
function createMockDb(options: {
  llmById?: ConfigRow[];
  llmDefault?: ConfigRow[];
  embeddingById?: ConfigRow[];
  embeddingDefault?: ConfigRow[];
}) {
  const whereCalls: { table: unknown; value: unknown }[] = [];

  const from = vi.fn().mockImplementation((table: unknown) => ({
    where: vi
      .fn()
      .mockImplementation(async (cond: { value?: unknown } | undefined) => {
        whereCalls.push({ table, value: cond?.value });
        let byId: ConfigRow[] | undefined;
        let byDefault: ConfigRow[] | undefined;
        if (table === llmConfigs) {
          byId = options.llmById;
          byDefault = options.llmDefault;
        } else if (table === embeddingConfigs) {
          byId = options.embeddingById;
          byDefault = options.embeddingDefault;
        }
        if (cond?.value === true) {
          return byDefault ?? [];
        }
        return byId ?? [];
      }),
  }));

  const db = {
    select: vi.fn().mockReturnValue({ from }),
  };

  return { db, from, whereCalls };
}

function createMockContext(
  mockDb: unknown,
  overrides: {
    env?: Record<string, unknown>;
    llm?: unknown;
    embedding?: unknown;
  } = {}
): ServiceContext {
  return {
    db: mockDb as never,
    embedding: (overrides.embedding ?? { __mock: "ctx-embedding" }) as never,
    env: (overrides.env ?? {}) as never,
    llm: (overrides.llm ?? { __mock: "ctx-llm" }) as never,
    vectorStore: {} as never,
  };
}

describe("resolveLLMModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("有効な modelConfigId を指定するとその設定でモデルを生成する", async () => {
    const { db, whereCalls } = createMockDb({ llmById: [customConfig] });

    const model = await resolveLLMModel(
      createMockContext(db),
      "cfg-custom",
      "throw"
    );

    expect(model).toEqual({
      __mock: "llm-from-config",
      configId: "cfg-custom",
    });
    expect(mockedCreateLLM).toHaveBeenCalledWith(
      customConfig,
      expect.anything()
    );
    // ID 検索でヒットしたためデフォルト設定の検索は行われないこと
    expect(whereCalls).toHaveLength(1);
  });

  it("onMissing: 'throw' で不明な modelConfigId は NotFoundError になりデフォルトへフォールバックしない", async () => {
    // デフォルト設定が存在しても使用しないこと
    const { db, whereCalls } = createMockDb({ llmDefault: [defaultConfig] });

    await expect(
      resolveLLMModel(createMockContext(db), "cfg-missing", "throw")
    ).rejects.toThrow(new NotFoundError("LLM Config", "cfg-missing"));
    expect(mockedCreateLLM).not.toHaveBeenCalled();
    expect(whereCalls).toHaveLength(1);
  });

  it("onMissing のデフォルトは 'throw' として動作する", async () => {
    const { db } = createMockDb({ llmDefault: [defaultConfig] });

    await expect(
      resolveLLMModel(createMockContext(db), "cfg-missing")
    ).rejects.toThrow(NotFoundError);
  });

  it("onMissing: 'useDefault' で不明な modelConfigId はデフォルト設定を使用する", async () => {
    const { db } = createMockDb({ llmDefault: [defaultConfig] });

    const model = await resolveLLMModel(
      createMockContext(db),
      "cfg-missing",
      "useDefault"
    );

    expect(model).toEqual({
      __mock: "llm-from-config",
      configId: "cfg-default",
    });
    expect(mockedCreateLLM).toHaveBeenCalledWith(
      defaultConfig,
      expect.anything()
    );
  });

  it("onMissing: 'useDefault' でもデフォルト設定がなければ ctx.llm を使用する", async () => {
    const { db } = createMockDb({});
    const ctx = createMockContext(db);

    const model = await resolveLLMModel(ctx, "cfg-missing", "useDefault");

    expect(model).toEqual({ __mock: "ctx-llm" });
  });

  it("modelConfigId 未指定（null）はデフォルト設定を使用する", async () => {
    const { db } = createMockDb({ llmDefault: [defaultConfig] });

    const model = await resolveLLMModel(createMockContext(db), null, "throw");

    expect(model).toEqual({
      __mock: "llm-from-config",
      configId: "cfg-default",
    });
  });

  it("modelConfigId 未指定でデフォルト設定もなければ ctx.llm を使用する", async () => {
    const { db } = createMockDb({});

    const model = await resolveLLMModel(
      createMockContext(db),
      undefined,
      "throw"
    );

    expect(model).toEqual({ __mock: "ctx-llm" });
    expect(mockedCreateLLM).not.toHaveBeenCalled();
  });
});

describe("resolveEmbeddingModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("有効な embeddingConfigId を指定するとその設定のモデルと dimensions を返す", async () => {
    const { db } = createMockDb({ embeddingById: [customEmbedding] });

    const resolved = await resolveEmbeddingModel(
      createMockContext(db),
      "emb-custom",
      "throw"
    );

    expect(resolved.model).toEqual({
      __mock: "embedding-from-config",
      configId: "emb-custom",
    });
    expect(resolved.dimensions).toBe(768);
    expect(resolved.config).toEqual(customEmbedding);
  });

  it("onMissing: 'throw' で不明な embeddingConfigId は NotFoundError になる", async () => {
    const { db } = createMockDb({ embeddingDefault: [defaultEmbedding] });

    await expect(
      resolveEmbeddingModel(createMockContext(db), "emb-missing", "throw")
    ).rejects.toThrow(NotFoundError);
  });

  it("onMissing: 'useDefault' で不明な embeddingConfigId はデフォルト設定を使用する", async () => {
    const { db } = createMockDb({ embeddingDefault: [defaultEmbedding] });

    const resolved = await resolveEmbeddingModel(
      createMockContext(db),
      "emb-missing",
      "useDefault"
    );

    expect(resolved.model).toEqual({
      __mock: "embedding-from-config",
      configId: "emb-default",
    });
    expect(resolved.dimensions).toBe(1024);
  });

  it("embeddingConfigId 未指定はデフォルト設定を使用する", async () => {
    const { db } = createMockDb({ embeddingDefault: [defaultEmbedding] });

    const resolved = await resolveEmbeddingModel(
      createMockContext(db),
      null,
      "throw"
    );

    expect(resolved.dimensions).toBe(1024);
  });

  it("設定未登録の場合は ctx.embedding と env.EMBEDDING_DIMENSIONS を使用する", async () => {
    const { db } = createMockDb({});
    const ctx = createMockContext(db, { env: { EMBEDDING_DIMENSIONS: 2048 } });

    const resolved = await resolveEmbeddingModel(ctx, undefined, "useDefault");

    expect(resolved.model).toEqual({ __mock: "ctx-embedding" });
    expect(resolved.dimensions).toBe(2048);
    expect(resolved.config).toBeUndefined();
  });

  it("env.EMBEDDING_DIMENSIONS 未設定の場合は 1536 にフォールバックする", async () => {
    const { db } = createMockDb({});

    const resolved = await resolveEmbeddingModel(
      createMockContext(db),
      undefined,
      "useDefault"
    );

    expect(resolved.dimensions).toBe(1536);
  });
});

describe("サービス経由の解決（内部解決は useDefault を維持）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("LlmConfigDomainService.resolveLanguageModel - 不明な ID でもエラーにせずデフォルトへフォールバックする", async () => {
    const { db } = createMockDb({ llmDefault: [defaultConfig] });
    const service = new LlmConfigDomainService(createMockContext(db));

    const model = await service.resolveLanguageModel("cfg-missing");

    expect(model).toEqual({
      __mock: "llm-from-config",
      configId: "cfg-default",
    });
  });

  it("EmbeddingConfigDomainService.resolveEmbeddingModel - 不明な ID でもエラーにせずデフォルトへフォールバックする", async () => {
    const { db } = createMockDb({ embeddingDefault: [defaultEmbedding] });
    const service = new EmbeddingConfigDomainService(createMockContext(db));

    const resolved = await service.resolveEmbeddingModel("emb-missing");

    expect(resolved.model).toEqual({
      __mock: "embedding-from-config",
      configId: "emb-default",
    });
    expect(resolved.dimensions).toBe(1024);
  });
});
