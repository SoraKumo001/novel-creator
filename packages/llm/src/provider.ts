import { embed as aiEmbed, generateText as aiGenerateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { EmbeddingModel, LanguageModel } from 'ai';
import type { Env, LLMProviderType } from '@novel-creator/shared';

export interface ProviderSettings {
  baseURL?: string;
  apiKey?: string;
}

export interface LLMConfigInput {
  provider: LLMProviderType;
  modelId: string;
  baseUrl?: string | null;
  apiKey?: string | null;
}

export interface EmbeddingConfigInput {
  provider: LLMProviderType;
  modelId: string;
  dimensions?: number | null;
  baseUrl?: string | null;
  apiKey?: string | null;
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs: number;
  message: string;
  error?: string;
}

/**
 * プロバイダ設定を構築する。
 */
function buildSettings(baseURL?: string | null, apiKey?: string | null): ProviderSettings {
  const settings: ProviderSettings = {};
  if (baseURL && baseURL.trim()) settings.baseURL = baseURL.trim();
  if (apiKey && apiKey.trim()) settings.apiKey = apiKey.trim();
  return settings;
}

/**
 * 設定解決の対象種別。
 * - 'llm': LLM 設定（LLM_* 環境変数のみフォールバック）
 * - 'embedding': Embedding 設定（EMBEDDING_* を優先し、一致しない場合は LLM_* へフォールバック）
 */
type SettingsKind = 'llm' | 'embedding';

/**
 * fallbackEnv から指定フィールドのフォールバック値を解決する。
 * プロバイダが一致する環境変数群のみ使用する。
 */
function resolveEnvValue(
  env: Env,
  kind: SettingsKind,
  provider: LLMProviderType,
  field: 'apiKey' | 'baseURL',
): string | undefined {
  if (kind === 'embedding' && env.EMBEDDING_PROVIDER === provider) {
    return field === 'apiKey' ? env.EMBEDDING_API_KEY : env.EMBEDDING_BASE_URL;
  }
  if (env.LLM_PROVIDER === provider) {
    return field === 'apiKey' ? env.LLM_API_KEY : env.LLM_BASE_URL;
  }
  return undefined;
}

/**
 * config の apiKey / baseUrl を解決し、未設定のフィールドを fallbackEnv で補完して
 * ProviderSettings を構築する。
 */
function resolveSettings(
  config: { provider: LLMProviderType; baseUrl?: string | null; apiKey?: string | null },
  fallbackEnv: Env | undefined,
  kind: SettingsKind,
): ProviderSettings {
  let apiKey = config.apiKey ?? undefined;
  let baseURL = config.baseUrl ?? undefined;

  if (fallbackEnv) {
    if (!apiKey) {
      apiKey = resolveEnvValue(fallbackEnv, kind, config.provider, 'apiKey');
    }
    if (!baseURL) {
      baseURL = resolveEnvValue(fallbackEnv, kind, config.provider, 'baseURL');
    }
  }

  return buildSettings(baseURL, apiKey);
}

/**
 * 指定プロバイダ・設定で LanguageModel を構築する。
 */
export function createLanguageModel(
  provider: LLMProviderType,
  model: string,
  settings: ProviderSettings,
): LanguageModel {
  switch (provider) {
    case 'openai': {
      const openai = createOpenAI(settings);
      // OpenAI / OpenAI互換エンドポイントともに Responses API（item_reference）ではなく
      // 互換性の高い Chat Completions API（.chat）を使用する
      return openai.chat(model);
    }
    case 'anthropic':
      return createAnthropic(settings)(model);
    case 'ollama': {
      // Ollama / OllamaCloud は OpenAI 互換 API（Chat Completions）を提供するため .chat を使用する。
      const openai = createOpenAI(settings);
      return openai.chat(model);
    }
    case 'google':
      return createGoogleGenerativeAI(settings)(model);
    case 'custom_openai': {
      // OpenRouter, Groq, LM Studio, vLLM などの OpenAI 互換エンドポイント（Chat Completions）
      const openai = createOpenAI(settings);
      return openai.chat(model);
    }
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported LLM provider: ${String(exhaustive)}`);
    }
  }
}

/**
 * 指定プロバイダ・設定で EmbeddingModel を構築する。
 *
 * Anthropic は embedding 非対応のため OpenAI にフォールバックする。
 */
export function createEmbeddingModel(
  provider: LLMProviderType,
  model: string,
  settings: ProviderSettings,
): EmbeddingModel {
  switch (provider) {
    case 'openai':
      return createOpenAI(settings).embedding(model);
    case 'anthropic': {
      // Anthropic は embedding 非対応。OpenAI にフォールバックする。
      if (!settings.apiKey) {
        console.warn(
          '[llm] Anthropic は embedding 非対応のため OpenAI にフォールバックします。' +
            'API キーが設定されていないため embedding は失敗する可能性があります。',
        );
      }
      return createOpenAI(settings).embedding(model);
    }
    case 'ollama':
      return createOpenAI(settings).embedding(model);
    case 'google':
      return createGoogleGenerativeAI(settings).embedding(model);
    case 'custom_openai':
      return createOpenAI(settings).embedding(model);
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported embedding provider: ${String(exhaustive)}`);
    }
  }
}

/**
 * LLMConfigInput から LanguageModel を生成する。
 * API キーや baseURL が未設定の場合、fallbackEnv があればフォールバックする。
 */
export function createLanguageModelFromConfig(
  config: LLMConfigInput,
  fallbackEnv?: Env,
): LanguageModel {
  return createLanguageModel(
    config.provider,
    config.modelId,
    resolveSettings(config, fallbackEnv, 'llm'),
  );
}

/**
 * env.LLM_PROVIDER に応じて AI SDK の LanguageModel インスタンスを返す。
 */
export function createLLMProvider(env: Env): LanguageModel {
  return createLanguageModel(
    env.LLM_PROVIDER,
    env.LLM_MODEL,
    buildSettings(env.LLM_BASE_URL, env.LLM_API_KEY),
  );
}

/**
 * AI SDK の EmbeddingModel インスタンスを返す。
 *
 * baseURL は EMBEDDING_BASE_URL を優先し、未設定の場合は LLM_BASE_URL にフォールバックする
 * （createEmbeddingModelFromConfig の config パスと対称な挙動）。
 * EMBEDDING_BASE_URL を明示設定している場合の挙動は変わらない。
 */
export function createEmbeddingProvider(env: Env): EmbeddingModel {
  const provider = env.EMBEDDING_PROVIDER ?? env.LLM_PROVIDER;
  const apiKey = env.EMBEDDING_API_KEY ?? env.LLM_API_KEY;
  const baseURL = env.EMBEDDING_BASE_URL ?? env.LLM_BASE_URL;

  return createEmbeddingModel(provider, env.EMBEDDING_MODEL, buildSettings(baseURL, apiKey));
}

/**
 * EmbeddingConfigInput から EmbeddingModel を生成する。
 * API キーや baseURL が未設定の場合、fallbackEnv があればフォールバックする
 * （EMBEDDING_* を優先し、プロバイダが一致しない場合は LLM_* へフォールバック）。
 */
export function createEmbeddingModelFromConfig(
  config: EmbeddingConfigInput,
  fallbackEnv?: Env,
): EmbeddingModel {
  return createEmbeddingModel(
    config.provider,
    config.modelId,
    resolveSettings(config, fallbackEnv, 'embedding'),
  );
}

/**
 * modelOrConfig が config 入力（modelId プロパティを持つオブジェクト）かどうかを判定する。
 * モデルインスタンス（LanguageModel / EmbeddingModel）は provider が自由文字列のため
 * ConfigInput には割り当てられない。この性質を利用して各接続テスト関数内で
 * config 入力とモデルインスタンスを狭め込む。
 */
type ConfigInput = LLMConfigInput | EmbeddingConfigInput;

function isConfigInput(modelOrConfig: unknown): modelOrConfig is ConfigInput {
  return typeof modelOrConfig === 'object' && modelOrConfig !== null && 'modelId' in modelOrConfig;
}

/**
 * 接続テストの共通実装。callable は成功時のメッセージを返す。
 * 失敗時は成否・レイテンシ・エラーメッセージを含む結果を返す。
 */
async function testConnection(callable: () => Promise<string>): Promise<TestConnectionResult> {
  const startTime = Date.now();
  try {
    const message = await callable();
    return {
      success: true,
      latencyMs: Date.now() - startTime,
      message,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      latencyMs,
      message: `接続失敗: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

/**
 * LLM への接続をテストし、成否とレイテンシを返す。
 */
export async function testLLMConnection(
  modelOrConfig: LanguageModel | LLMConfigInput,
  fallbackEnv?: Env,
): Promise<TestConnectionResult> {
  return testConnection(async () => {
    const model = isConfigInput(modelOrConfig)
      ? createLanguageModelFromConfig(modelOrConfig, fallbackEnv)
      : modelOrConfig;

    const res = await aiGenerateText({
      model,
      prompt: 'ping',
    });

    return res.text ? `接続成功: ${res.text.slice(0, 30)}` : '接続成功';
  });
}

/**
 * Embedding への接続をテストし、成否とレイテンシ、次元数を返す。
 */
export async function testEmbeddingConnection(
  modelOrConfig: EmbeddingModel | EmbeddingConfigInput,
  fallbackEnv?: Env,
): Promise<TestConnectionResult> {
  return testConnection(async () => {
    const model = isConfigInput(modelOrConfig)
      ? createEmbeddingModelFromConfig(modelOrConfig, fallbackEnv)
      : modelOrConfig;

    const res = await aiEmbed({
      model,
      value: 'ping test for embedding dimension and connection',
    });

    return `接続成功 (検出次元数: ${res.embedding.length})`;
  });
}
