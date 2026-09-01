import { eq, desc } from 'drizzle-orm';
import type { LanguageModel } from 'ai';
import { llmConfigs, type LLMConfig, type NewLLMConfig } from '@novel-creator/db';
import { testLLMConnection, type LLMConfigInput } from '@novel-creator/llm';
import { resolveLLMModel as resolveLLMModelShared } from './model-resolver.js';
import { assertFound, ValidationError, type ServiceContext } from './types.js';

export interface MaskedLLMConfig extends Omit<LLMConfig, 'apiKey'> {
  apiKeyMasked: string | null;
  hasApiKey: boolean;
}

function maskApiKey(key?: string | null): { apiKeyMasked: string | null; hasApiKey: boolean } {
  if (!key || !key.trim()) {
    return { apiKeyMasked: null, hasApiKey: false };
  }
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return { apiKeyMasked: '********', hasApiKey: true };
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return { apiKeyMasked: `${prefix}....${suffix}`, hasApiKey: true };
}

export class LlmConfigDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listConfigs(): Promise<MaskedLLMConfig[]> {
    const rows = await this.ctx.db
      .select()
      .from(llmConfigs)
      .orderBy(desc(llmConfigs.isDefault), desc(llmConfigs.createdAt));

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

  async getConfig(id: string): Promise<LLMConfig> {
    const [row] = await this.ctx.db.select().from(llmConfigs).where(eq(llmConfigs.id, id));
    assertFound(row, 'LLM Config not found');
    return row;
  }

  async createConfig(
    data: Omit<NewLLMConfig, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MaskedLLMConfig> {
    if (!data.name?.trim()) {
      throw new ValidationError('Name is required');
    }
    if (!data.modelId?.trim()) {
      throw new ValidationError('Model ID is required');
    }

    // 初めてのモデル設定なら自動的に isDefault を true にする
    const existingCount = await this.ctx.db.select().from(llmConfigs);
    const shouldBeDefault = data.isDefault || existingCount.length === 0;

    if (shouldBeDefault) {
      await this.ctx.db.update(llmConfigs).set({ isDefault: false });
    }

    const [row] = await this.ctx.db
      .insert(llmConfigs)
      .values({
        ...data,
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
    data: Partial<Omit<NewLLMConfig, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<MaskedLLMConfig> {
    const current = await this.getConfig(id);

    if (data.isDefault) {
      await this.ctx.db.update(llmConfigs).set({ isDefault: false });
    }

    // apiKey が空文字列ではなく undefined で渡された場合（変更なし）は既存のキーを維持
    const apiKey = data.apiKey !== undefined ? data.apiKey : current.apiKey;

    const [row] = await this.ctx.db
      .update(llmConfigs)
      .set({
        ...data,
        apiKey,
        updatedAt: new Date(),
      })
      .where(eq(llmConfigs.id, id))
      .returning();

    assertFound(row, 'LLM Config not found');
    const { apiKeyMasked, hasApiKey } = maskApiKey(row.apiKey);

    const { apiKey: _, ...rest } = row;
    return { ...rest, apiKeyMasked, hasApiKey };
  }

  async deleteConfig(id: string): Promise<void> {
    const current = await this.getConfig(id);
    const [deleted] = await this.ctx.db.delete(llmConfigs).where(eq(llmConfigs.id, id)).returning();
    assertFound(deleted, 'LLM Config not found');

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
    await this.getConfig(id);
    await this.ctx.db.update(llmConfigs).set({ isDefault: false });
    const [row] = await this.ctx.db
      .update(llmConfigs)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(llmConfigs.id, id))
      .returning();
    assertFound(row, 'LLM Config not found');

    const { apiKeyMasked, hasApiKey } = maskApiKey(row.apiKey);

    const { apiKey: _, ...rest } = row;
    return { ...rest, apiKeyMasked, hasApiKey };
  }

  async testConfig(input: LLMConfigInput) {
    return testLLMConnection(input, this.ctx.env);
  }

  /**
   * 指定された設定（未指定・不明時はデフォルト設定、それも無ければ環境変数の LLM）から
   * LanguageModel を解決する。共通リゾルバへの委譲（従来の id→miss→default 挙動を維持）。
   */
  async resolveLanguageModel(modelConfigId?: string | null): Promise<LanguageModel> {
    return resolveLLMModelShared(this.ctx, modelConfigId, 'useDefault');
  }
}
