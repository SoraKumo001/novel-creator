import type { LanguageModel } from "ai";
import { generateText as aiGenerateText, streamText as aiStreamText } from "ai";
import { LLM_MAX_OUTPUT_TOKENS, LLM_TIMEOUT_MS } from "./llm-config.js";
import type { RetryOptions } from "./retry.js";
import { withRetry } from "./retry.js";

/**
 * generateText / streamText の呼び出しオプション。
 * RetryOptions に加え、呼び出し単位のタイムアウトと最大出力トークン数を指定できる。
 * 未指定時は環境変数（LLM_TIMEOUT_MS / LLM_MAX_OUTPUT_TOKENS）または既定値にフォールバックする。
 */
export interface GenerateTextOptions extends RetryOptions {
  /** 最大出力トークン数。未指定時は既定値（8192） */
  maxOutputTokens?: number;
  /** 呼び出し単位のタイムアウト（ms）。未指定時は既定値（120000） */
  timeoutMs?: number;
}

/**
 * AI SDK の generateText ラッパー。生成されたテキストを返す。
 * ネットワークエラー・429・500 系エラーはリトライする。
 * タイムアウト（AbortSignal.timeout）による中断はリトライせずそのまま伝播する。
 */
export async function generateText(
  model: LanguageModel,
  prompt: string,
  options: GenerateTextOptions = {}
): Promise<string> {
  const {
    maxOutputTokens = LLM_MAX_OUTPUT_TOKENS,
    timeoutMs = LLM_TIMEOUT_MS,
    ...retryOptions
  } = options;
  const abortSignal = AbortSignal.timeout(timeoutMs);
  return withRetry(async () => {
    const result = await aiGenerateText({
      abortSignal,
      maxOutputTokens,
      model,
      prompt,
    });
    return result.text;
  }, retryOptions);
}

/**
 * AI SDK の streamText ラッパー。テキストのチャンクを逐次 yield する。
 * ストリーム開始後はリトライできないため、接続時（ストリーム開始前）のみリトライする。
 * タイムアウト（AbortSignal.timeout）による中断はリトライせずそのまま伝播する。
 */
export async function* streamText(
  model: LanguageModel,
  prompt: string,
  options: GenerateTextOptions = {}
): AsyncGenerator<string> {
  const {
    maxOutputTokens = LLM_MAX_OUTPUT_TOKENS,
    timeoutMs = LLM_TIMEOUT_MS,
    ...retryOptions
  } = options;
  const abortSignal = AbortSignal.timeout(timeoutMs);
  const result = await withRetry(
    async () =>
      aiStreamText({
        abortSignal,
        maxOutputTokens,
        model,
        prompt,
      }),
    retryOptions
  );
  for await (const chunk of result.textStream) {
    yield chunk;
  }
}
