import {
  type EmbeddingConfig,
  embeddingConfigs,
  type NewEmbeddingConfig,
} from "@novel-creator/db";
import {
  type EmbeddingConfigInput,
  testEmbeddingConnection,
} from "@novel-creator/llm";
import { desc, eq } from "drizzle-orm";
import {
  type ResolvedEmbeddingModel,
  resolveEmbeddingModel as resolveEmbeddingModelShared,
} from "./model-resolver.js";
import { assertFound, type ServiceContext, ValidationError } from "./types.js";

export interface MaskedEmbeddingConfig extends Omit<EmbeddingConfig, "apiKey"> {
  apiKeyMasked: string | null;
  hasApiKey: boolean;
}

function maskApiKey(key?: string | null): {
  apiKeyMasked: string | null;
  hasApiKey: boolean;
} {
  if (!key?.trim()) {
    return { apiKeyMasked: null, hasApiKey: false };
  }
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return { apiKeyMasked: "********", hasApiKey: true };
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return { apiKeyMasked: `${prefix}....${suffix}`, hasApiKey: true };
}

export class EmbeddingConfigDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listConfigs(): Promise<MaskedEmbeddingConfig[]> {
    const rows = await this.ctx.db
      .select()
      .from(embeddingConfigs)
      .orderBy(
        desc(embeddingConfigs.isDefault),
        desc(embeddingConfigs.createdAt)
      );

    return rows.map((row) => {
      const { apiKeyMasked, hasApiKey } = maskApiKey(row.apiKey);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { apiKey, ...rest } = row;
      return {
        ...rest,
        apiKeyMasked,
        hasApiKey,
      };
    });
  }

  async getConfig(id: string): Promise<EmbeddingConfig> {
    const [row] = await this.ctx.db
      .select()
      .from(embeddingConfigs)
      .where(eq(embeddingConfigs.id, id));
    assertFound(row, "Embedding Config not found");
    return row;
  }

  async createConfig(
    data: Omit<NewEmbeddingConfig, "id" | "createdAt" | "updatedAt">
  ): Promise<MaskedEmbeddingConfig> {
    if (!data.name?.trim()) {
      throw new ValidationError("Name is required");
    }
    if (!data.modelId?.trim()) {
      throw new ValidationError("Model ID is required");
    }

    const existingCount = await this.ctx.db.select().from(embeddingConfigs);
    const shouldBeDefault = data.isDefault || existingCount.length === 0;

    if (shouldBeDefault) {
      await this.ctx.db.update(embeddingConfigs).set({ isDefault: false });
    }

    const [row] = await this.ctx.db
      .insert(embeddingConfigs)
      .values({
        ...data,
        dimensions: data.dimensions ?? 1536,
        isDefault: shouldBeDefault,
      })
      .returning();

    const { apiKeyMasked, hasApiKey } = maskApiKey(row.apiKey);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { apiKey, ...rest } = row;
    return { ...rest, apiKeyMasked, hasApiKey };
  }

  async updateConfig(
    id: string,
    data: Partial<Omit<NewEmbeddingConfig, "id" | "createdAt" | "updatedAt">>
  ): Promise<MaskedEmbeddingConfig> {
    const current = await this.getConfig(id);

    if (data.isDefault) {
      await this.ctx.db.update(embeddingConfigs).set({ isDefault: false });
    }

    const apiKey = data.apiKey === undefined ? current.apiKey : data.apiKey;

    const [row] = await this.ctx.db
      .update(embeddingConfigs)
      .set({
        ...data,
        apiKey,
        updatedAt: new Date(),
      })
      .where(eq(embeddingConfigs.id, id))
      .returning();

    assertFound(row, "Embedding Config not found");
    const { apiKeyMasked, hasApiKey } = maskApiKey(row.apiKey);

    const { apiKey: _, ...rest } = row;
    return { ...rest, apiKeyMasked, hasApiKey };
  }

  async deleteConfig(id: string): Promise<void> {
    const current = await this.getConfig(id);
    const [deleted] = await this.ctx.db
      .delete(embeddingConfigs)
      .where(eq(embeddingConfigs.id, id))
      .returning();
    assertFound(deleted, "Embedding Config not found");

    if (current.isDefault) {
      const [latest] = await this.ctx.db
        .select()
        .from(embeddingConfigs)
        .orderBy(desc(embeddingConfigs.createdAt));
      if (latest) {
        await this.ctx.db
          .update(embeddingConfigs)
          .set({ isDefault: true })
          .where(eq(embeddingConfigs.id, latest.id));
      }
    }
  }

  async setDefault(id: string): Promise<MaskedEmbeddingConfig> {
    await this.getConfig(id);
    await this.ctx.db.update(embeddingConfigs).set({ isDefault: false });
    const [row] = await this.ctx.db
      .update(embeddingConfigs)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(embeddingConfigs.id, id))
      .returning();
    assertFound(row, "Embedding Config not found");

    const { apiKeyMasked, hasApiKey } = maskApiKey(row.apiKey);

    const { apiKey: _, ...rest } = row;
    return { ...rest, apiKeyMasked, hasApiKey };
  }

  async testConfig(input: EmbeddingConfigInput) {
    return testEmbeddingConnection(input, this.ctx.env);
  }

  /**
   * 指定された設定（未指定・不明時はデフォルト設定、それも無ければ環境変数の Embedding）から
   * モデルと次元数を解決する。共通リゾルバへの委譲（従来の id→miss→default 挙動を維持）。
   */
  async resolveEmbeddingModel(
    embeddingConfigId?: string | null
  ): Promise<ResolvedEmbeddingModel> {
    return resolveEmbeddingModelShared(
      this.ctx,
      embeddingConfigId,
      "useDefault"
    );
  }
}
