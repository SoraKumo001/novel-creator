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
import { desc, eq, isNull, or } from "drizzle-orm";
import {
  decryptApiKey,
  encryptApiKey,
  getSecretEncryptionKeyValue,
  maskApiKeyForDisplay,
} from "../lib/secret-crypto.js";
import { resolveLLMModel as resolveLLMModelShared } from "./model-resolver.js";
import {
  assertFound,
  ForbiddenError,
  type ServiceContext,
  ValidationError,
} from "./types.js";

export interface MaskedLLMConfig extends Omit<LLMConfig, "apiKey"> {
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  isSystem: boolean;
}

export interface UserContext {
  id: string;
  role?: string | null;
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
      isSystem: row.userId === null,
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

  /**
   * 設定一覧を取得する。
   * - ログインユーザーの設定 ＋ システム共通設定 (userId IS NULL) を返却する。
   * - ソート順: ユーザーデフォルト > ユーザー個別 > システムデフォルト > システム共通 > 作成日時降順
   */
  async listConfigs(user?: UserContext | null): Promise<MaskedLLMConfig[]> {
    const rows = user
      ? await this.ctx.db
          .select()
          .from(llmConfigs)
          .where(or(isNull(llmConfigs.userId), eq(llmConfigs.userId, user.id)))
          .orderBy(desc(llmConfigs.isDefault), desc(llmConfigs.createdAt))
      : await this.ctx.db
          .select()
          .from(llmConfigs)
          .orderBy(desc(llmConfigs.isDefault), desc(llmConfigs.createdAt));

    const masked = await Promise.all(rows.map((row) => this.toMasked(row)));

    return masked.sort((a, b) => {
      // 1. ユーザー自身のデフォルト
      const aUserDefault = user && a.userId === user.id && a.isDefault ? 1 : 0;
      const bUserDefault = user && b.userId === user.id && b.isDefault ? 1 : 0;
      if (aUserDefault !== bUserDefault) return bUserDefault - aUserDefault;

      // 2. ユーザー自身の個別設定
      const aUser = user && a.userId === user.id ? 1 : 0;
      const bUser = user && b.userId === user.id ? 1 : 0;
      if (aUser !== bUser) return bUser - aUser;

      // 3. システム共通デフォルト
      const aSysDefault = a.userId === null && a.isDefault ? 1 : 0;
      const bSysDefault = b.userId === null && b.isDefault ? 1 : 0;
      if (aSysDefault !== bSysDefault) return bSysDefault - aSysDefault;

      // 4. 作成日時降順
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      );
    });
  }

  /**
   * マスク済み設定を返す。生の apiKey は含まない (S0-1)。
   */
  async getConfig(
    id: string,
    user?: UserContext | null
  ): Promise<MaskedLLMConfig> {
    const row = await this.findRawById(id);
    if (user && row.userId && row.userId !== user.id && user.role !== "admin") {
      throw new ForbiddenError("Forbidden");
    }
    return this.toMasked(row);
  }

  async createConfig(
    data: Omit<NewLLMConfig, "id" | "createdAt" | "updatedAt"> & {
      isSystem?: boolean;
    },
    user?: UserContext | null
  ): Promise<MaskedLLMConfig> {
    if (!data.name?.trim()) {
      throw new ValidationError("Name is required");
    }
    if (!data.modelId?.trim()) {
      throw new ValidationError("Model ID is required");
    }

    const isAdmin = user ? user.role === "admin" : true;
    // user が渡されていない場合はシステム共通設定として扱う
    const isSystem = user ? (isAdmin ? (data.isSystem ?? false) : false) : true;
    const targetUserId = isSystem ? null : (user?.id ?? null);

    if (!isSystem && !targetUserId) {
      throw new ValidationError("User ID is required for user LLM config");
    }

    // 同一スコープ（ユーザー個別 or システム共通）内の既存設定数をカウント
    const scopeCondition = targetUserId
      ? eq(llmConfigs.userId, targetUserId)
      : isNull(llmConfigs.userId);

    const existingInScope = await this.ctx.db
      .select()
      .from(llmConfigs)
      .where(scopeCondition);

    // そのスコープで初めての設定なら自動的に isDefault を true にする
    const shouldBeDefault = data.isDefault || existingInScope.length === 0;

    if (shouldBeDefault) {
      await this.ctx.db
        .update(llmConfigs)
        .set({ isDefault: false })
        .where(scopeCondition);
    }

    // apiKey は保存前に必ず暗号化する。鍵未設定時はここで明示エラーになる。
    const apiKey = await encryptApiKey(
      data.apiKey,
      await this.getSecretKeyValue()
    );

    const [row] = await this.ctx.db
      .insert(llmConfigs)
      .values({
        apiKey,
        baseUrl: data.baseUrl,
        description: data.description,
        isDefault: shouldBeDefault,
        modelId: data.modelId,
        name: data.name,
        provider: data.provider,
        userId: targetUserId,
      })
      .returning();

    assertFound(row, "LLM Config not found");
    return this.toMasked(row);
  }

  async updateConfig(
    id: string,
    data: Partial<Omit<NewLLMConfig, "id" | "createdAt" | "updatedAt">> & {
      isSystem?: boolean;
    },
    user?: UserContext | null
  ): Promise<MaskedLLMConfig> {
    const current = await this.findRawById(id);
    const isAdmin = user ? user.role === "admin" : true;

    // 権限チェック
    if (user) {
      if (current.userId === null) {
        if (!isAdmin) {
          throw new ForbiddenError("Admin only");
        }
      } else if (current.userId !== user.id && !isAdmin) {
        throw new ForbiddenError("Forbidden");
      }
    }

    let targetUserId = current.userId;
    if (isAdmin && data.isSystem !== undefined) {
      targetUserId = data.isSystem
        ? null
        : (current.userId ?? user?.id ?? null);
    }

    const scopeCondition = targetUserId
      ? eq(llmConfigs.userId, targetUserId)
      : isNull(llmConfigs.userId);

    if (data.isDefault) {
      await this.ctx.db
        .update(llmConfigs)
        .set({ isDefault: false })
        .where(scopeCondition);
    }

    // apiKey が undefined で渡された場合（変更なし）は既存の保存値を維持する。
    // 明示的に指定された場合は暗号化して保存する (null / 空文字はキー削除)。
    const apiKey =
      data.apiKey === undefined
        ? current.apiKey
        : await encryptApiKey(data.apiKey, await this.getSecretKeyValue());

    const { isSystem: _, ...restData } = data;

    const [row] = await this.ctx.db
      .update(llmConfigs)
      .set({
        ...restData,
        apiKey,
        updatedAt: new Date(),
        userId: targetUserId,
      })
      .where(eq(llmConfigs.id, id))
      .returning();

    assertFound(row, "LLM Config not found");
    return this.toMasked(row);
  }

  async deleteConfig(id: string, user?: UserContext | null): Promise<void> {
    const current = await this.findRawById(id);
    const isAdmin = user ? user.role === "admin" : true;

    if (user) {
      if (current.userId === null) {
        if (!isAdmin) {
          throw new ForbiddenError("Admin only");
        }
      } else if (current.userId !== user.id && !isAdmin) {
        throw new ForbiddenError("Forbidden");
      }
    }

    const [deleted] = await this.ctx.db
      .delete(llmConfigs)
      .where(eq(llmConfigs.id, id))
      .returning();
    assertFound(deleted, "LLM Config not found");

    // 削除されたものがデフォルトだった場合、同一スコープ内の残りの最新レコードをデフォルトにする
    if (current.isDefault) {
      const scopeCondition = current.userId
        ? eq(llmConfigs.userId, current.userId)
        : isNull(llmConfigs.userId);

      const [latest] = await this.ctx.db
        .select()
        .from(llmConfigs)
        .where(scopeCondition)
        .orderBy(desc(llmConfigs.createdAt))
        .limit(1);

      if (latest) {
        await this.ctx.db
          .update(llmConfigs)
          .set({ isDefault: true })
          .where(eq(llmConfigs.id, latest.id));
      }
    }
  }

  async setDefault(
    id: string,
    user?: UserContext | null
  ): Promise<MaskedLLMConfig> {
    const current = await this.findRawById(id);
    const isAdmin = user ? user.role === "admin" : true;

    if (user) {
      if (current.userId === null) {
        if (!isAdmin) {
          throw new ForbiddenError("Admin only");
        }
      } else if (current.userId !== user.id && !isAdmin) {
        throw new ForbiddenError("Forbidden");
      }
    }

    const scopeCondition = current.userId
      ? eq(llmConfigs.userId, current.userId)
      : isNull(llmConfigs.userId);

    await this.ctx.db
      .update(llmConfigs)
      .set({ isDefault: false })
      .where(scopeCondition);

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
    modelConfigId?: string | null,
    userId?: string | null
  ): Promise<LanguageModel> {
    return resolveLLMModelShared(this.ctx, modelConfigId, "useDefault", userId);
  }
}
