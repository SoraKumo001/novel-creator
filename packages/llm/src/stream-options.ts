import type { LLMProviderType } from "@novel-creator/shared";
import type {
  JSONValue,
  LanguageModel,
  OutputInterface,
  StopCondition,
  StreamTextResult,
  ToolSet,
} from "ai";
import { streamText as aiStreamText } from "ai";
import {
  ANTHROPIC_THINKING_BUDGET_TOKENS,
  LLM_MAX_OUTPUT_TOKENS,
  LLM_TIMEOUT_MS,
  OPENAI_REASONING_MODEL_PATTERN,
} from "./llm-config.js";
import type { RetryOptions } from "./retry.js";
import { withRetry } from "./retry.js";

/**
 * AI SDK 側では Arrayable<T> = T | T[] | undefined として定義されているが、
 * `ai` パッケージからは export されないためローカルで同型を定義する。
 */
type Arrayable<T> = T | T[] | undefined;

/**
 * プロバイダ固有オプション（AI SDK の ProviderOptions）。
 * `ai` パッケージは ProviderOptions（@ai-sdk/provider-utils 由来の
 * `Record<string, JSONObject>` 同型）を再エクスポートしないため、
 * 同型をローカルで定義している。
 */
export type ProviderOptions = Record<string, Record<string, JSONValue>>;

/**
 * streamText の各 LLM ステップの進捗情報。
 * - step: 1 始まりのステップ番号
 * - finishReason: phase が "step-finish" のときのみ設定される
 */
export interface StepProgress {
  finishReason?: string;
  phase: "step-start" | "step-finish";
  step: number;
}

export interface StreamTextOptions extends RetryOptions {
  /** 最大出力トークン数。未指定時は既定値（8192） */
  maxOutputTokens?: number;
  /** 各 LLM ステップの開始・終了時に呼ばれる進捗コールバック */
  onStep?: (progress: StepProgress) => void;
  /** プロバイダ固有オプション（例: reasoning / thinking の有効化） */
  providerOptions?: ProviderOptions;
  /** ツールループの停止条件。未指定時は AI SDK デフォルト（isStepCount(1)） */
  stopWhen?: Arrayable<StopCondition<ToolSet, Record<string, unknown>>>;
  /** 呼び出し単位のタイムアウト（ms）。未指定時は既定値（120000） */
  timeoutMs?: number;
  /** LLM に渡すツール群（AI SDK の tool() 形式） */
  tools?: ToolSet;
}

/**
 * 解決されたプロバイダ・モデル ID から、推論（reasoning / thinking）を
 * 有効化するためのプロバイダ固有オプションを構築する。
 * - openai: reasoning モデル（o1 / o3 / o4 / gpt-5 系）のみ reasoningEffort を設定
 * - anthropic: thinking を enabled（budgetTokens 付き）で設定
 * - google: thinkingConfig.includeThoughts を設定
 * - ollama / custom_openai: 対応しない（DeepSeek-R1 等は reasoning をネイティブに返す）
 *
 * 対象外のプロバイダ・モデルでは undefined を返す。
 */
export function buildReasoningProviderOptions(
  provider: LLMProviderType,
  modelId: string
): ProviderOptions | undefined {
  switch (provider) {
    case "openai":
      return OPENAI_REASONING_MODEL_PATTERN.test(modelId)
        ? { openai: { reasoningEffort: "medium" } }
        : undefined;
    case "anthropic":
      return {
        anthropic: {
          thinking: {
            budgetTokens: ANTHROPIC_THINKING_BUDGET_TOKENS,
            type: "enabled",
          },
        },
      };
    case "google":
      return { google: { thinkingConfig: { includeThoughts: true } } };
    case "ollama":
    case "custom_openai":
      return undefined;
    default:
      return undefined;
  }
}

/**
 * AI SDK の streamText ラッパー。生の StreamTextResult をそのまま返す。
 * ストリーム開始後はリトライできないため、接続時（ストリーム開始前）のみリトライする。
 */
export async function streamTextResult<
  TOOLS extends ToolSet = Record<string, never>,
>(
  model: LanguageModel,
  prompt: string,
  options: StreamTextOptions = {} as StreamTextOptions
): Promise<StreamTextResult<TOOLS, Record<string, unknown>, OutputInterface>> {
  const {
    maxOutputTokens = LLM_MAX_OUTPUT_TOKENS,
    timeoutMs = LLM_TIMEOUT_MS,
    ...retryOptions
  } = options;
  const abortSignal = AbortSignal.timeout(timeoutMs);
  return withRetry(
    async () =>
      aiStreamText({
        abortSignal,
        maxOutputTokens,
        model,
        prompt,
        ...(options.tools ? { tools: options.tools as TOOLS } : {}),
        ...(options.stopWhen
          ? {
              stopWhen: options.stopWhen as NonNullable<
                StreamTextOptions["stopWhen"]
              >,
            }
          : {}),
        ...(options.providerOptions
          ? { providerOptions: options.providerOptions }
          : {}),
        ...(options.onStep
          ? {
              onStepStart: ({ stepNumber }: { stepNumber: number }) => {
                options.onStep?.({
                  phase: "step-start",
                  step: stepNumber + 1,
                });
              },
              onStepEnd: ({
                finishReason,
                stepNumber,
              }: {
                finishReason: string;
                stepNumber: number;
              }) => {
                options.onStep?.({
                  finishReason,
                  phase: "step-finish",
                  step: stepNumber + 1,
                });
              },
            }
          : {}),
      }),
    retryOptions
  );
}
