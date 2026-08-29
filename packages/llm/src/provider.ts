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
 * 指定プロバイダ・設定で LanguageModel を構築する。
 */
export function createLanguageModel(
  provider: LLMProviderType,
  model: string,
  settings: ProviderSettings,
): LanguageModel {
  switch (provider) {
    case 'openai':
      return createOpenAI(settings)(model);
    case 'anthropic':
      return createAnthropic(settings)(model);
    case 'ollama':
      // Ollama / OllamaCloud は OpenAI 互換 API を提供するため createOpenAI を使用する。
      return createOpenAI(settings)(model);
    case 'google':
      return createGoogleGenerativeAI(settings)(model);
    case 'custom_openai':
      // OpenRouter, Groq, LM Studio, vLLM などの OpenAI 互換エンドポイント
      return createOpenAI(settings)(model);
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
  let apiKey = config.apiKey ?? undefined;
  let baseURL = config.baseUrl ?? undefined;

  if (!apiKey && fallbackEnv) {
    // プロバイダが一致する場合はプロバイダ固有の環境変数をフォールバック利用
    if (fallbackEnv.LLM_PROVIDER === config.provider) {
      apiKey = fallbackEnv.LLM_API_KEY;
    }
  }

  if (!baseURL && fallbackEnv) {
    if (fallbackEnv.LLM_PROVIDER === config.provider) {
      baseURL = fallbackEnv.LLM_BASE_URL;
    }
  }

  return createLanguageModel(config.provider, config.modelId, buildSettings(baseURL, apiKey));
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
 */
export function createEmbeddingProvider(env: Env): EmbeddingModel {
  const provider = (env.EMBEDDING_PROVIDER ?? env.LLM_PROVIDER) as LLMProviderType;
  const apiKey = env.EMBEDDING_API_KEY ?? env.LLM_API_KEY;
  const baseURL = env.EMBEDDING_BASE_URL;

  return createEmbeddingModel(provider, env.EMBEDDING_MODEL, buildSettings(baseURL, apiKey));
}

/**
 * LLM への接続をテストし、成否とレイテンシを返す。
 */
export async function testLLMConnection(
  modelOrConfig: LanguageModel | LLMConfigInput,
  fallbackEnv?: Env,
): Promise<TestConnectionResult> {
  const startTime = Date.now();
  try {
    let model: LanguageModel;
    if (typeof modelOrConfig === 'object' && 'modelId' in modelOrConfig) {
      model = createLanguageModelFromConfig(modelOrConfig as LLMConfigInput, fallbackEnv);
    } else {
      model = modelOrConfig as LanguageModel;
    }

    const res = await aiGenerateText({
      model,
      prompt: 'ping',
    });

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      latencyMs,
      message: res.text ? `接続成功: ${res.text.slice(0, 30)}` : '接続成功',
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
 * EmbeddingConfigInput から EmbeddingModel を生成する。
 */
export function createEmbeddingModelFromConfig(
  config: EmbeddingConfigInput,
  fallbackEnv?: Env,
): EmbeddingModel {
  let apiKey = config.apiKey ?? undefined;
  let baseURL = config.baseUrl ?? undefined;

  if (!apiKey && fallbackEnv) {
    if (fallbackEnv.EMBEDDING_PROVIDER === config.provider && fallbackEnv.EMBEDDING_API_KEY) {
      apiKey = fallbackEnv.EMBEDDING_API_KEY;
    } else if (fallbackEnv.LLM_PROVIDER === config.provider && fallbackEnv.LLM_API_KEY) {
      apiKey = fallbackEnv.LLM_API_KEY;
    }
  }

  if (!baseURL && fallbackEnv) {
    if (fallbackEnv.EMBEDDING_PROVIDER === config.provider && fallbackEnv.EMBEDDING_BASE_URL) {
      baseURL = fallbackEnv.EMBEDDING_BASE_URL;
    } else if (fallbackEnv.LLM_PROVIDER === config.provider && fallbackEnv.LLM_BASE_URL) {
      baseURL = fallbackEnv.LLM_BASE_URL;
    }
  }

  return createEmbeddingModel(config.provider, config.modelId, buildSettings(baseURL, apiKey));
}

/**
 * Embedding への接続をテストし、成否とレイテンシ、次元数を返す。
 */
export async function testEmbeddingConnection(
  modelOrConfig: EmbeddingModel | EmbeddingConfigInput,
  fallbackEnv?: Env,
): Promise<TestConnectionResult> {
  const startTime = Date.now();
  try {
    let model: EmbeddingModel;
    if (typeof modelOrConfig === 'object' && 'modelId' in modelOrConfig) {
      model = createEmbeddingModelFromConfig(modelOrConfig as EmbeddingConfigInput, fallbackEnv);
    } else {
      model = modelOrConfig as EmbeddingModel;
    }

    const res = await aiEmbed({
      model,
      value: 'ping test for embedding dimension and connection',
    });

    const latencyMs = Date.now() - startTime;
    const dimensions = res.embedding.length;
    return {
      success: true,
      latencyMs,
      message: `接続成功 (検出次元数: ${dimensions})`,
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
