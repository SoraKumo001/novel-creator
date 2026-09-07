import {
  type EmbeddingConfig,
  embeddingConfigs,
  type NewEmbeddingConfig,
} from "@novel-creator/db";
import {
  type EmbeddingConfigInput,
  listModels as fetchOpenAIModels,
  testEmbeddingConnection,
} from "@novel-creator/llm";
import { desc, eq } from "drizzle-orm";
import {
  decryptApiKey,
  encryptApiKey,
  getSecretEncryptionKeyValue,
  maskApiKeyForDisplay,
} from "../lib/secret-crypto.js";
import {
  type ResolvedEmbeddingModel,
  resolveEmbeddingModel as resolveEmbeddingModelShared,
} from "./model-resolver.js";
import { assertFound, type ServiceContext, ValidationError } from "./types.js";

export interface MaskedEmbeddingConfig extends Omit<EmbeddingConfig, "apiKey"> {
  apiKeyMasked: string | null;
  hasApiKey: boolean;
}

export class EmbeddingConfigDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  private getSecretKeyValue(): Promise<string | undefined> {
    return getSecretEncryptionKeyValue(this.ctx.env);
  }

  /**
   * DB 行をマスク済み表現に変換する。保存値 (暗号文の可能性あり) をサーバ内で復号してから
   * マスクし、生のキーを呼び出し側に返さない。
   */
  private async toMasked(row: EmbeddingConfig): Promise<MaskedEmbeddingConfig> {
    const apiKey = await decryptApiKey(
      row.apiKey,
      await this.getSecretKeyValue()
    );
    const { apiKeyMasked, hasApiKey } = maskApiKeyForDisplay(apiKey);
    const { apiKey: _, ...rest } = row;
    return {
      ...rest,
      apiKeyMasked,
      hasApiKey,
    };
  }

  /**
   * 内部利用向けの生行取得。返却値の apiKey は暗号文の可能性があり、
   * HTTP 応答に含めてはならない。
   */
  private async findRawById(id: string): Promise<EmbeddingConfig> {
    const [row] = await this.ctx.db
      .select()
      .from(embeddingConfigs)
      .where(eq(embeddingConfigs.id, id));
    assertFound(row, "Embedding Config not found");
    return row;
  }

  async listConfigs(): Promise<MaskedEmbeddingConfig[]> {
    const rows = await this.ctx.db
      .select()
      .from(embeddingConfigs)
      .orderBy(
        desc(embeddingConfigs.isDefault),
        desc(embeddingConfigs.createdAt)
      );

    return Promise.all(rows.map((row) => this.toMasked(row)));
  }

  /**
   * マスク済み設定を返す。生の apiKey は含まない (S0-1)。
   */
  async getConfig(id: string): Promise<MaskedEmbeddingConfig> {
    return this.toMasked(await this.findRawById(id));
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

    // apiKey は保存前に必ず暗号化する。鍵未設定時はここで明示エラーになる。
    const apiKey = await encryptApiKey(
      data.apiKey,
      await this.getSecretKeyValue()
    );

    const [row] = await this.ctx.db
      .insert(embeddingConfigs)
      .values({
        ...data,
        apiKey,
        dimensions: data.dimensions ?? 1536,
        isDefault: shouldBeDefault,
      })
      .returning();

    assertFound(row, "Embedding Config not found");
    return this.toMasked(row);
  }

  async updateConfig(
    id: string,
    data: Partial<Omit<NewEmbeddingConfig, "id" | "createdAt" | "updatedAt">>
  ): Promise<MaskedEmbeddingConfig> {
    const current = await this.findRawById(id);

    if (data.isDefault) {
      await this.ctx.db.update(embeddingConfigs).set({ isDefault: false });
    }

    // apiKey が undefined で渡された場合（変更なし）は既存の保存値を維持する。
    // 明示的に指定された場合は暗号化して保存する (null / 空文字はキー削除)。
    const apiKey =
      data.apiKey === undefined
        ? current.apiKey
        : await encryptApiKey(data.apiKey, await this.getSecretKeyValue());

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
    return this.toMasked(row);
  }

  async deleteConfig(id: string): Promise<void> {
    const current = await this.findRawById(id);
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
    await this.findRawById(id);
    await this.ctx.db.update(embeddingConfigs).set({ isDefault: false });
    const [row] = await this.ctx.db
      .update(embeddingConfigs)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(embeddingConfigs.id, id))
      .returning();
    assertFound(row, "Embedding Config not found");

    return this.toMasked(row);
  }

  async testConfig(input: EmbeddingConfigInput) {
    return testEmbeddingConnection(input, this.ctx.env);
  }

  async listModels(input: { apiKey?: string | null; baseUrl: string }) {
    const models = await fetchOpenAIModels(input.baseUrl, input.apiKey);
    return { models };
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
