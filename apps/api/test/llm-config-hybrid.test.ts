import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LlmConfigDomainService } from "../src/core/llm-config.service.js";
import type { ServiceContext } from "../src/core/types.js";
import { generateEncryptionKeyBase64 } from "../src/lib/secret-crypto.js";

type Row = Record<string, unknown>;

function createFakeDb() {
  const rows: Row[] = [];

  const fromResult = () =>
    Object.assign([...rows], {
      orderBy: async (..._args: unknown[]): Promise<Row[]> => [...rows],
      where: (..._args: unknown[]) =>
        Object.assign([...rows], {
          orderBy: async (..._args2: unknown[]): Promise<Row[]> => [...rows],
        }),
    });

  const db = {
    delete: () => ({
      where: (..._args: unknown[]) => ({
        returning: async (): Promise<Row[]> => rows.splice(0, 1),
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
        for (const row of rows) {
          Object.assign(row, patch);
        }
        return Object.assign(Promise.resolve([] as Row[]), {
          where: (..._args: unknown[]) => ({
            returning: async (): Promise<Row[]> => [...rows],
          }),
        });
      },
    }),
  };

  return { db, rows };
}

async function createServiceContext(
  db: unknown,
  masterValue: string | undefined
): Promise<ServiceContext> {
  return {
    db: db as never,
    embedding: {} as never,
    env: {
      MASTER_SECRET: masterValue,
      LLM_MODEL: "env-default-model",
      LLM_PROVIDER: "openai",
    } as never,
    llm: { modelId: "env-default-model", provider: "openai" } as never,
    vectorStore: {} as never,
  };
}

describe("LLM Config Hybrid (User + System)", () => {
  it("一般ユーザーは自身の設定を作成でき、userId が設定される", async () => {
    const master = generateEncryptionKeyBase64();
    const { db, rows } = createFakeDb();
    const ctx = await createServiceContext(db, master);
    const service = new LlmConfigDomainService(ctx);

    const normalUser = { id: "user-123", role: "user" };
    const created = await service.createConfig(
      {
        apiKey: "sk-user-key",
        modelId: "gpt-4o",
        name: "My Custom GPT",
        provider: "openai",
      },
      normalUser
    );

    expect(created.name).toBe("My Custom GPT");
    expect(created.isSystem).toBe(false);
    expect(created.userId).toBe("user-123");
    expect(rows[0].userId).toBe("user-123");
  });

  it("Admin は isSystem: true を指定してシステム共通設定を作成できる", async () => {
    const master = generateEncryptionKeyBase64();
    const { db, rows } = createFakeDb();
    const ctx = await createServiceContext(db, master);
    const service = new LlmConfigDomainService(ctx);

    const adminUser = { id: "admin-1", role: "admin" };
    const created = await service.createConfig(
      {
        apiKey: "sk-ant-key",
        isSystem: true,
        modelId: "claude-3-5-sonnet-20241022",
        name: "System Claude",
        provider: "anthropic",
      },
      adminUser
    );

    expect(created.isSystem).toBe(true);
    expect(created.userId).toBeNull();
    expect(rows[0].userId).toBeNull();
  });

  it("一般ユーザーはシステム共通設定を更新・削除・デフォルト化できない", async () => {
    const master = generateEncryptionKeyBase64();
    const { db, rows } = createFakeDb();
    const ctx = await createServiceContext(db, master);
    const service = new LlmConfigDomainService(ctx);

    // システム設定行を直接格納
    const sysConfig: Row = {
      createdAt: new Date(),
      id: "sys-cfg-1",
      isDefault: true,
      modelId: "gpt-4o-mini",
      name: "System Default",
      provider: "openai",
      updatedAt: new Date(),
      userId: null,
    };
    rows.push(sysConfig);

    const normalUser = { id: "user-123", role: "user" };

    // 更新不可
    await expect(
      service.updateConfig("sys-cfg-1", { name: "Hacked" }, normalUser)
    ).rejects.toThrow("Admin only");

    // 削除不可
    await expect(service.deleteConfig("sys-cfg-1", normalUser)).rejects.toThrow(
      "Admin only"
    );

    // デフォルト化不可
    await expect(service.setDefault("sys-cfg-1", normalUser)).rejects.toThrow(
      "Admin only"
    );
  });

  it("一般ユーザーは他人の個別設定を閲覧・更新・削除できない", async () => {
    const master = generateEncryptionKeyBase64();
    const { db, rows } = createFakeDb();
    const ctx = await createServiceContext(db, master);
    const service = new LlmConfigDomainService(ctx);

    const otherUserConfig: Row = {
      createdAt: new Date(),
      id: "other-cfg-1",
      isDefault: false,
      modelId: "gpt-4o",
      name: "Other User Model",
      provider: "openai",
      updatedAt: new Date(),
      userId: "other-user-999",
    };
    rows.push(otherUserConfig);

    const normalUser = { id: "user-123", role: "user" };

    await expect(service.getConfig("other-cfg-1", normalUser)).rejects.toThrow(
      "Forbidden"
    );
    await expect(
      service.updateConfig("other-cfg-1", { name: "Hacked" }, normalUser)
    ).rejects.toThrow("Forbidden");
    await expect(
      service.deleteConfig("other-cfg-1", normalUser)
    ).rejects.toThrow("Forbidden");
  });
});
