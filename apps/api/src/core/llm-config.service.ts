import {
  type LLMConfig,
  llmConfigs,
  type NewLLMConfig,
} from "@novel-creator/db";
import {
  listModels as fetchOpenAIModels,
  type LLMConfigInput,
  testLLMConnection,
} from "@novel-creator/llm";
import type { LanguageModel } from "ai";
import { desc, eq } from "drizzle-orm";
import {
  decryptApiKey,
  encryptApiKey,
  getSecretEncryptionKeyValue,
  maskApiKeyForDisplay,
} from "../lib/secret-crypto.js";
import { resolveLLMModel as resolveLLMModelShared } from "./model-resolver.js";
import { assertFound, type ServiceContext, ValidationError } from "./types.js";

export interface MaskedLLMConfig extends Omit<LLMConfig, "apiKey"> {
  apiKeyMasked: string | null;
  hasApiKey: boolean;
}

/**
 * baseUrl の入力値を検証する。不合格の場合は ValidationError を投げる。
 * - 未指定（undefined / null / 空文字）は許容する
 * - http(s) 以外のスキームを拒否する
 * - http は localhost / 127.0.0.1 のみ許容する（それ以外は https を要求）
 * - 埋め込みクレデンシャル（user:pass@）を拒否する
 */
function assertValidBaseUrl(baseUrl?: string | null): void {
  if (!baseUrl?.trim()) {
    return;
  }
  const raw = baseUrl.trim();

  if (!URL.canParse(raw)) {
    throw new ValidationError(
      "baseUrl must be a valid URL (e.g. https://api.example.com/v1)"
    );
  }
  const url = new URL(raw);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ValidationError("baseUrl must use http or https scheme");
  }
  if (url.username !== "" || url.password !== "") {
    throw new ValidationError(
      "baseUrl must not contain embedded credentials (user:pass@)"
    );
  }
  if (url.protocol === "http:") {
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      throw new ValidationError(
        "http:// baseUrl is only allowed for localhost / 127.0.0.1"
      );
    }
  }
}

export class LlmConfigDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  private getSecretKeyValue(): Promise<string | undefined> {
    return getSecretEncryptionKeyValue(this.ctx.env);
  }

  /**
   * DB 行をマスク済み表現に変換する。保存値 (暗号文の可能性あり) をサーバ内で復号してから
   * マスクし、生のキーを呼び出し側に返さない。
   */
  private async toMasked(row: LLMConfig): Promise<MaskedLLMConfig> {
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
  private async findRawById(id: string): Promise<LLMConfig> {
    const [row] = await this.ctx.db
      .select()
      .from(llmConfigs)
      .where(eq(llmConfigs.id, id));
    assertFound(row, "LLM Config not found");
    return row;
  }

  async listConfigs(): Promise<MaskedLLMConfig[]> {
    const rows = await this.ctx.db
      .select()
      .from(llmConfigs)
      .orderBy(desc(llmConfigs.isDefault), desc(llmConfigs.createdAt));

    return Promise.all(rows.map((row) => this.toMasked(row)));
  }

  /**
   * マスク済み設定を返す。生の apiKey は含まない (S0-1)。
   */
  async getConfig(id: string): Promise<MaskedLLMConfig> {
    return this.toMasked(await this.findRawById(id));
  }

  async createConfig(
    data: Omit<NewLLMConfig, "id" | "createdAt" | "updatedAt">
  ): Promise<MaskedLLMConfig> {
    if (!data.name?.trim()) {
      throw new ValidationError("Name is required");
    }
    if (!data.modelId?.trim()) {
      throw new ValidationError("Model ID is required");
    }

    // 初めてのモデル設定なら自動的に isDefault を true にする
    const existingCount = await this.ctx.db.select().from(llmConfigs);
    const shouldBeDefault = data.isDefault || existingCount.length === 0;

    if (shouldBeDefault) {
      await this.ctx.db.update(llmConfigs).set({ isDefault: false });
    }

    // apiKey は保存前に必ず暗号化する。鍵未設定時はここで明示エラーになる。
    const apiKey = await encryptApiKey(
      data.apiKey,
      await this.getSecretKeyValue()
    );

    const [row] = await this.ctx.db
      .insert(llmConfigs)
      .values({
        ...data,
        apiKey,
        isDefault: shouldBeDefault,
      })
      .returning();

    assertFound(row, "LLM Config not found");
    return this.toMasked(row);
  }

  async updateConfig(
    id: string,
    data: Partial<Omit<NewLLMConfig, "id" | "createdAt" | "updatedAt">>
  ): Promise<MaskedLLMConfig> {
    const current = await this.findRawById(id);

    if (data.isDefault) {
      await this.ctx.db.update(llmConfigs).set({ isDefault: false });
    }

    // apiKey が undefined で渡された場合（変更なし）は既存の保存値を維持する。
    // 明示的に指定された場合は暗号化して保存する (null / 空文字はキー削除)。
    const apiKey =
      data.apiKey === undefined
        ? current.apiKey
        : await encryptApiKey(data.apiKey, await this.getSecretKeyValue());

    const [row] = await this.ctx.db
      .update(llmConfigs)
      .set({
        ...data,
        apiKey,
        updatedAt: new Date(),
      })
      .where(eq(llmConfigs.id, id))
      .returning();

    assertFound(row, "LLM Config not found");
    return this.toMasked(row);
  }

  async deleteConfig(id: string): Promise<void> {
    const current = await this.findRawById(id);
    const [deleted] = await this.ctx.db
      .delete(llmConfigs)
      .where(eq(llmConfigs.id, id))
      .returning();
    assertFound(deleted, "LLM Config not found");

    // 削除されたものがデフォルトだった場合、残りの最新レコードをデフォルトにする
    if (current.isDefault) {
      const [latest] = await this.ctx.db
        .select()
        .from(llmConfigs)
        .orderBy(desc(llmConfigs.createdAt));
      if (latest) {
        await this.ctx.db
          .update(llmConfigs)
          .set({ isDefault: true })
          .where(eq(llmConfigs.id, latest.id));
      }
    }
  }

  async setDefault(id: string): Promise<MaskedLLMConfig> {
    await this.findRawById(id);
    await this.ctx.db.update(llmConfigs).set({ isDefault: false });
    const [row] = await this.ctx.db
      .update(llmConfigs)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(llmConfigs.id, id))
      .returning();
    assertFound(row, "LLM Config not found");

    return this.toMasked(row);
  }

  async testConfig(input: LLMConfigInput) {
    assertValidBaseUrl(input.baseUrl);
    return testLLMConnection(input, this.ctx.env);
  }

  async listModels(input: { apiKey?: string | null; baseUrl: string }) {
    assertValidBaseUrl(input.baseUrl);
    const models = await fetchOpenAIModels(input.baseUrl, input.apiKey);
    return { models };
  }

  /**
   * 指定された設定（未指定・不明時はデフォルト設定、それも無ければ環境変数の LLM）から
   * LanguageModel を解決する。共通リゾルバへの委譲（従来の id→miss→default 挙動を維持）。
   */
  async resolveLanguageModel(
    modelConfigId?: string | null
  ): Promise<LanguageModel> {
    return resolveLLMModelShared(this.ctx, modelConfigId, "useDefault");
  }
}
