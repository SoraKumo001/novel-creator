import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EmbeddingConfigDomainService } from "../src/core/embedding-config.service.js";
import { LlmConfigDomainService } from "../src/core/llm-config.service.js";
import type { ServiceContext } from "../src/core/types.js";
import { deriveEncryptionKeyBase64 } from "../src/lib/master-secret.js";
import {
  decryptApiKey,
  ENCRYPTED_SECRET_PREFIX,
  generateEncryptionKeyBase64,
} from "../src/lib/secret-crypto.js";

type Row = Record<string, unknown>;

/**
 * 最小限の in-memory DB モック。
 * where 条件の評価は行わないため、更新系のテストでは1件のみ格納して使用する。
 */
function createFakeDb() {
  const rows: Row[] = [];

  const fromResult = () => {
    const snapshot = [...rows];
    return Object.assign(snapshot, {
      orderBy: async (..._args: unknown[]): Promise<Row[]> => [...rows],
      where: (..._args: unknown[]) =>
        Object.assign([...rows], {
          orderBy: async (..._args2: unknown[]): Promise<Row[]> => [...rows],
        }),
    });
  };

  const db = {
    delete: () => ({
      where: (..._args: unknown[]) => ({
        returning: async (): Promise<Row[]> => rows.splice(0, rows.length),
      }),
    }),
    insert: () => ({
      values: (value: Row) => ({
        returning: async (): Promise<Row[]> => {
          const now = new Date();
          const row: Row = {
            createdAt: now,
            updatedAt: now,
            ...value,
            id: (value["id"] as string | undefined) ?? randomUUID(),
          };
          rows.push(row);
          return [row];
        },
      }),
    }),
    select: () => ({
      from: (..._args: unknown[]) => fromResult(),
    }),
    update: () => ({
      set: (patch: Row) => {
        const applyToAll = (): Row[] => {
          for (const row of rows) {
            Object.assign(row, patch);
          }
          return [...rows];
        };
        return Object.assign(Promise.resolve([] as Row[]), {
          where: (..._args: unknown[]) => ({
            returning: async (): Promise<Row[]> => applyToAll(),
          }),
        });
      },
    }),
  };

  return { db, rows };
}

/**
 * テスト用の MASTER_SECRET と、サービスが導出する暗号化鍵のペアを生成する。
 * ServiceContext の env には master を渡し、decryptApiKey の直接呼び出しには
 * 導出鍵 key を使う（サービス内部の導出と同一値）。
 */
async function createMasterKeys(): Promise<{ key: string; master: string }> {
  const master = generateEncryptionKeyBase64();
  const key = await deriveEncryptionKeyBase64(master);
  return { key, master };
}

function createServiceContext(
  db: unknown,
  masterValue: string | undefined
): ServiceContext {
  return {
    db: db as never,
    embedding: {} as never,
    env: { MASTER_SECRET: masterValue } as never,
    llm: {} as never,
    vectorStore: {} as never,
  };
}

const llmBase = {
  baseUrl: null,
  description: null,
  isDefault: false,
  modelId: "gpt-4o-mini",
  name: "Test LLM",
  provider: "openai",
};

describe("LLM config API key encryption (S0-1)", () => {
  it("createConfig は暗号文を保存しマスクのみ返すこと", async () => {
    const { key, master } = await createMasterKeys();
    const { db, rows } = createFakeDb();
    const service = new LlmConfigDomainService(
      createServiceContext(db, master)
    );

    const created = await service.createConfig({
      ...llmBase,
      apiKey: "sk-test-secret-12345678",
    });

    expect("apiKey" in created).toBe(false);
    expect(created.hasApiKey).toBe(true);
    expect(created.apiKeyMasked).toBe("sk-t....5678");
    expect(rows).toHaveLength(1);
    const stored = rows[0]?.["apiKey"];
    expect(typeof stored).toBe("string");
    expect(String(stored).startsWith(ENCRYPTED_SECRET_PREFIX)).toBe(true);
    expect(String(stored)).not.toContain("sk-test-secret-12345678");
    await expect(decryptApiKey(stored as string, key)).resolves.toBe(
      "sk-test-secret-12345678"
    );
  });

  it("getConfig は生 apiKey を返さないこと", async () => {
    const { master } = await createMasterKeys();
    const { db } = createFakeDb();
    const service = new LlmConfigDomainService(
      createServiceContext(db, master)
    );
    const created = await service.createConfig({
      ...llmBase,
      apiKey: "sk-test-secret-12345678",
    });

    const fetched = await service.getConfig(created.id as string);
    expect("apiKey" in fetched).toBe(false);
    expect(fetched.hasApiKey).toBe(true);
    expect(fetched.apiKeyMasked).toBe("sk-t....5678");
  });

  it("レガシー平文もマスク一覧で読めること (遅延移行)", async () => {
    const { master } = await createMasterKeys();
    const { db, rows } = createFakeDb();
    rows.push({
      ...llmBase,
      apiKey: "AIzaLegacyPlain12345678",
      createdAt: new Date(),
      id: randomUUID(),
      updatedAt: new Date(),
    });
    const service = new LlmConfigDomainService(
      createServiceContext(db, master)
    );

    const listed = await service.listConfigs();
    expect(listed).toHaveLength(1);
    expect("apiKey" in listed[0]).toBe(false);
    expect(listed[0]?.hasApiKey).toBe(true);
    expect(listed[0]?.apiKeyMasked).toContain("AIza");
  });

  it("updateConfig で apiKey 未指定時は保存値を維持すること", async () => {
    const { master } = await createMasterKeys();
    const { db, rows } = createFakeDb();
    const service = new LlmConfigDomainService(
      createServiceContext(db, master)
    );
    const created = await service.createConfig({
      ...llmBase,
      apiKey: "sk-original-key-12345678",
    });
    const storedBefore = rows[0]?.["apiKey"];

    const updated = await service.updateConfig(created.id as string, {
      name: "Renamed",
    });
    expect(updated.name).toBe("Renamed");
    expect(rows[0]?.["apiKey"]).toBe(storedBefore);
    expect("apiKey" in updated).toBe(false);
  });

  it("updateConfig で新しい apiKey は再暗号化されること", async () => {
    const { key, master } = await createMasterKeys();
    const { db, rows } = createFakeDb();
    const service = new LlmConfigDomainService(
      createServiceContext(db, master)
    );
    const created = await service.createConfig({
      ...llmBase,
      apiKey: "sk-original-key-12345678",
    });

    const updated = await service.updateConfig(created.id as string, {
      apiKey: "sk-rotated-key-99999999",
    });
    expect(updated.apiKeyMasked).toBe("sk-r....9999");
    await expect(
      decryptApiKey(rows[0]?.["apiKey"] as string, key)
    ).resolves.toBe("sk-rotated-key-99999999");
  });

  it("鍵未設定時は createConfig が明示エラーになること", async () => {
    const { db, rows } = createFakeDb();
    const service = new LlmConfigDomainService(
      createServiceContext(db, undefined)
    );
    await expect(
      service.createConfig({ ...llmBase, apiKey: "sk-test-secret" })
    ).rejects.toThrow("MASTER_SECRET");
    expect(rows).toHaveLength(0);
  });
});

describe("Embedding config API key encryption (S0-1)", () => {
  it("createConfig は暗号文を保存しマスクのみ返すこと", async () => {
    const { key, master } = await createMasterKeys();
    const { db, rows } = createFakeDb();
    const service = new EmbeddingConfigDomainService(
      createServiceContext(db, master)
    );

    const created = await service.createConfig({
      apiKey: "AIzaFakeKey12345678",
      baseUrl: null,
      description: null,
      dimensions: 768,
      isDefault: false,
      modelId: "gemini-embedding-001",
      name: "Test Embedding",
      provider: "google",
    });

    expect("apiKey" in created).toBe(false);
    expect(created.hasApiKey).toBe(true);
    expect(created.apiKeyMasked).toContain("AIza");
    const stored = rows[0]?.["apiKey"];
    expect(String(stored).startsWith(ENCRYPTED_SECRET_PREFIX)).toBe(true);
    await expect(decryptApiKey(stored as string, key)).resolves.toBe(
      "AIzaFakeKey12345678"
    );
  });
});
