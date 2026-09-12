import {
  type EmbeddingConfig,
  embeddingConfigs,
  type LLMConfig,
  llmConfigs,
} from "@novel-creator/db";
import {
  createEmbeddingModelFromConfig,
  createLanguageModelFromConfig,
} from "@novel-creator/llm";
import type { LLMProviderType } from "@novel-creator/shared";
import type { EmbeddingModel, LanguageModel } from "ai";
import { and, eq, isNull } from "drizzle-orm";
import {
  decryptApiKey,
  getSecretEncryptionKeyValue,
} from "../lib/secret-crypto.js";
import { NotFoundError, type ServiceContext } from "./types.js";

/**
 * modelConfigId / embeddingConfigId で指定された設定が見つからなかった場合の挙動ポリシー。
 * - 'throw': NotFoundError をスローする。ユーザーが明示指定した ID が DB 上に存在しないのに
 *   黙って別モデルへフォールバックすると意図しないモデルで生成してしまうため、
 *   ユーザー指定の ID を受け付けるフローではこちらを指定する。
 * - 'useDefault': デフォルト設定（未登録なら ctx のモデル）へフォールバックする。
 *   内部・システム的な解決で従来の id→miss→default 挙動を維持したい場合に指定する。
 */
export type ResolveMissingPolicy = "throw" | "useDefault";

interface ModelResolutionSpec<TConfig, TResult> {
  /** 設定が見つからない場合のエラーメッセージに使う設定名（例: 'LLM Config'）。 */
  configLabel: string;
  /** DB に設定が一切登録されていない場合のフォールバック。 */
  fallback(ctx: ServiceContext): TResult;
  /** 指定 ID の設定行を取得する。見つからなければ undefined。 */
  findById(ctx: ServiceContext, id: string): Promise<TConfig | undefined>;
  /** デフォルト設定行を取得する。見つからなければ undefined。 */
  findDefault(ctx: ServiceContext): Promise<TConfig | undefined>;
  /** 設定行からモデル（または解決結果）を生成する。 */
  toResult(config: TConfig, ctx: ServiceContext): TResult | Promise<TResult>;
}

/**
 * 「指定 ID の設定 →（見つからなければポリシーに応じて throw / 継続）→ デフォルト設定 →
 * ctx 既定モデル」という解決フローの共通実装。LLM / Embedding の双方から使用する。
 */
async function resolveFromConfigTable<TConfig, TResult>(
  ctx: ServiceContext,
  configId: string | null | undefined,
  onMissing: ResolveMissingPolicy,
  spec: ModelResolutionSpec<TConfig, TResult>
): Promise<TResult> {
  if (configId) {
    const config = await spec.findById(ctx, configId);
    if (config) {
      return await spec.toResult(config, ctx);
    }
    if (onMissing === "throw") {
      throw new NotFoundError(spec.configLabel, configId);
    }
  }

  const defaultConfig = await spec.findDefault(ctx);
  if (defaultConfig) {
    return await spec.toResult(defaultConfig, ctx);
  }
  return spec.fallback(ctx);
}

/**
 * resolveLLMModelWithInfo の戻り値。解決されたモデルに加えて
 * プロバイダ種別・モデル ID を返す（例: 推論オプションの構築に使用する）。
 * baseUrl は OpenCode 互換エンドポイント判定などのリクエスト単位の分岐に使用する。
 */
export interface ResolvedLLMModel {
  baseUrl?: string | null;
  model: LanguageModel;
  modelId: string;
  provider: LLMProviderType;
}

/**
 * OpenCode 互換エンドポイント（Console Go 等）へルーティングされているかを判定する。
 * provider ラベルが "openai" のまま baseURL だけ Console Go を指す
 * デフォルトLLM（環境変数）構成でも検出できるよう、baseURL も見る。
 */
export function isOpenCodeRoutedEndpoint(
  baseUrl: string | null | undefined
): boolean {
  return (
    baseUrl !== null &&
    baseUrl !== undefined &&
    /opencode|console-?go/i.test(baseUrl)
  );
}

/**
 * OpenCode 互換エンドポイント向けのリクエスト単位ヘッダーを構築する。
 * sessionId には会話単位で安定した ID（chatSessions.id / sectionId / novelId）を渡す。
 * 対象外プロバイダでは undefined を返す（他プロバイダには送らない）。
 * 行の baseUrl が空でも transport は env baseURL にフォールバックするため、
 * 判定は実効 URL（解決値 ?? env）で行う。envBaseUrl には ctx.env.LLM_BASE_URL を渡す。
 */
export function buildOpenCodeSessionHeaders(
  resolved: Pick<ResolvedLLMModel, "provider" | "baseUrl">,
  sessionId: string,
  envBaseUrl?: string | null
): Record<string, string> | undefined {
  const effectiveBaseUrl = resolved.baseUrl ?? envBaseUrl ?? null;
  if (
    resolved.provider === "custom_openai" ||
    isOpenCodeRoutedEndpoint(effectiveBaseUrl)
  ) {
    return { "x-opencode-session": sessionId };
  }
  return undefined;
}

/**
 * LLM モデルをプロバイダ情報込みで解決する。
 * 解決フローは resolveLLMModel と同一（モデル ID とプロバイダも返す点が異なる）。
 * 1. modelConfigId が指定されていればその設定でモデルを生成
 * 2. 見つからない場合は onMissing ポリシーに従う（'throw' なら NotFoundError）
 * 3. デフォルト設定（isDefault = true）があればそれを使用
 * 3. デフォルト設定の解決:
 *    a. userId が指定されている場合、ユーザー個別のデフォルト設定（userId = userId AND isDefault = true）
 *    b. システム共通のデフォルト設定（userId IS NULL AND isDefault = true）
 *    c. レガシー設定など他のデフォルト設定
 * 4. DB に設定がなければ ctx.llm（環境変数由来の既定モデル）を使用
 */
export async function resolveLLMModelWithInfo(
  ctx: ServiceContext,
  modelConfigId?: string | null,
  onMissing: ResolveMissingPolicy = "throw",
  userId?: string | null
): Promise<ResolvedLLMModel> {
  const effectiveUserId = userId ?? ctx.userId ?? null;

  return resolveFromConfigTable<LLMConfig, ResolvedLLMModel>(
    ctx,
    modelConfigId,
    onMissing,
    {
      configLabel: "LLM Config",
      fallback: (context) => ({
        baseUrl: context.env.LLM_BASE_URL ?? null,
        model: context.llm,
        modelId: context.env.LLM_MODEL,
        provider: context.env.LLM_PROVIDER,
      }),
      async findById(context, id) {
        const [config] = await context.db
          .select()
          .from(llmConfigs)
          .where(eq(llmConfigs.id, id));
        // 他人の個別設定へのアクセスは遮断する
        if (
          config &&
          config.userId &&
          effectiveUserId &&
          config.userId !== effectiveUserId
        ) {
          return undefined;
        }
        return config;
      },
      async findDefault(context) {
        if (effectiveUserId) {
          const [userConfig] = await context.db
            .select()
            .from(llmConfigs)
            .where(
              and(
                eq(llmConfigs.userId, effectiveUserId),
                eq(llmConfigs.isDefault, true)
              )
            );
          if (userConfig) {
            return userConfig;
          }
        }
        const [sysConfig] = await context.db
          .select()
          .from(llmConfigs)
          .where(
            and(isNull(llmConfigs.userId), eq(llmConfigs.isDefault, true))
          );
        return sysConfig;
      },
      toResult: async (config, context) => {
        // 保存値 (暗号文の可能性あり) をサーバ内でのみ復号してクライアントを構築する。
        // 復号前後で同一参照の場合は元の設定をそのまま渡す。
        const apiKey = await decryptApiKey(
          config.apiKey,
          await getSecretEncryptionKeyValue(context.env)
        );
        const input = apiKey === config.apiKey ? config : { ...config, apiKey };
        return {
          baseUrl: config.baseUrl ?? null,
          model: createLanguageModelFromConfig(input, context.env),
          modelId: config.modelId,
          provider: config.provider,
        };
      },
    }
  );
}

/**
 * LLM モデルを解決する。
 * 1. modelConfigId が指定されていればその設定でモデルを生成
 * 2. 見つからない場合は onMissing ポリシーに従う（'throw' なら NotFoundError）
 * 3. デフォルト設定（ユーザー個別デフォルト → システム共通デフォルト）があればそれを使用
 * 4. DB に設定がなければ ctx.llm（環境変数由来の既定モデル）を使用
 */
export async function resolveLLMModel(
  ctx: ServiceContext,
  modelConfigId?: string | null,
  onMissing: ResolveMissingPolicy = "throw",
  userId?: string | null
): Promise<LanguageModel> {
  return (await resolveLLMModelWithInfo(ctx, modelConfigId, onMissing, userId))
    .model;
}

/** resolveEmbeddingModel の戻り値。DB 設定から解決した場合は元の設定行も返す。 */
export interface ResolvedEmbeddingModel {
  config?: EmbeddingConfig;
  dimensions: number;
  model: EmbeddingModel;
}

/**
 * Embedding モデルと次元数を解決する。
 * 1. embeddingConfigId が指定されていればその設定（model と dimensions）を使用
 * 2. 見つからない場合は onMissing ポリシーに従う（'throw' なら NotFoundError）
 * 3. デフォルト設定（isDefault = true）があればそれを使用
 * 4. DB に設定がなければ ctx.embedding（環境変数由来の既定モデル）と
 *    env.EMBEDDING_DIMENSIONS を使用
 *
 * 戻り値の形が LLM 版と異なる（dimensions を伴う）ため、resolveLLMModel とは別関数としている。
 */
export async function resolveEmbeddingModel(
  ctx: ServiceContext,
  embeddingConfigId?: string | null,
  onMissing: ResolveMissingPolicy = "throw"
): Promise<ResolvedEmbeddingModel> {
  return resolveFromConfigTable<EmbeddingConfig, ResolvedEmbeddingModel>(
    ctx,
    embeddingConfigId,
    onMissing,
    {
      configLabel: "Embedding Config",
      fallback: (context) => ({
        dimensions: context.env.EMBEDDING_DIMENSIONS ?? 1536,
        model: context.embedding,
      }),
      async findById(context, id) {
        const [config] = await context.db
          .select()
          .from(embeddingConfigs)
          .where(eq(embeddingConfigs.id, id));
        return config;
      },
      async findDefault(context) {
        const [config] = await context.db
          .select()
          .from(embeddingConfigs)
          .where(eq(embeddingConfigs.isDefault, true));
        return config;
      },
      toResult: async (config, context) => {
        // 保存値 (暗号文の可能性あり) をサーバ内でのみ復号してクライアントを構築する。
        // config 自体は DB 行をそのまま返す (apiKey は暗号文の可能性があり、HTTP 返却禁止)。
        const apiKey = await decryptApiKey(
          config.apiKey,
          await getSecretEncryptionKeyValue(context.env)
        );
        const input = apiKey === config.apiKey ? config : { ...config, apiKey };
        return {
          config,
          dimensions: config.dimensions,
          model: createEmbeddingModelFromConfig(input, context.env),
        };
      },
    }
  );
}
