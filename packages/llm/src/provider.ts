import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { EmbeddingModel, LanguageModel } from 'ai';
import type { Env } from '@novel-creator/shared';

type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'google';

interface ProviderSettings {
  baseURL?: string;
  apiKey?: string;
}

/**
 * 環境変数からプロバイダ設定を構築する。
 */
function buildSettings(baseURL: string | undefined, apiKey: string | undefined): ProviderSettings {
  const settings: ProviderSettings = {};
  if (baseURL) settings.baseURL = baseURL;
  if (apiKey) settings.apiKey = apiKey;
  return settings;
}

/**
 * 指定プロバイダ・設定で LanguageModel を構築する。
 */
function createLanguageModel(
  provider: ProviderType,
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
      // OllamaCloud の場合は baseURL に https://ollama.com/v1 を指定する。
      return createOpenAI(settings)(model);
    case 'google':
      return createGoogleGenerativeAI(settings)(model);
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
function createEmbeddingModel(
  provider: ProviderType,
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
      // Ollama / OllamaCloud は OpenAI 互換 API で embedding も提供する。
      return createOpenAI(settings).embedding(model);
    case 'google':
      return createGoogleGenerativeAI(settings).embedding(model);
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unsupported embedding provider: ${String(exhaustive)}`);
    }
  }
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
 * EMBEDDING_* 環境変数が設定されている場合はそちらを優先し、
 * 未設定の場合は LLM_* の設定をフォールバック使用する。
 *
 * ただし baseURL はプロバイダ固有のエンドポイントであるため、
 * EMBEDDING_BASE_URL が未設定の場合はフォールバックせず undefined とする
 * （各プロバイダのデフォルトエンドポイントを使用）。
 */
export function createEmbeddingProvider(env: Env): EmbeddingModel {
  const provider = env.EMBEDDING_PROVIDER ?? env.LLM_PROVIDER;
  const apiKey = env.EMBEDDING_API_KEY ?? env.LLM_API_KEY;
  // baseURL は EMBEDDING_BASE_URL が未設定ならフォールバックしない
  // （LLM_BASE_URL は LLM プロバイダ用のエンドポイントであり、
  //   別プロバイダの Embedding に流用すると誤動作するため）
  const baseURL = env.EMBEDDING_BASE_URL;

  return createEmbeddingModel(provider, env.EMBEDDING_MODEL, buildSettings(baseURL, apiKey));
}
