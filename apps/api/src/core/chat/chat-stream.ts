import { chatMessages, chatSessions } from "@novel-creator/db";
import { type ProviderOptions, streamTextResult } from "@novel-creator/llm";
import type { ToolSet } from "ai";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  toUIMessageStream,
} from "ai";
import { eq } from "drizzle-orm";
import { formatErrorMessage } from "../../middleware/error-handler.js";
import { appLogger } from "../../middleware/logger.js";
import type { ResolvedLLMModel } from "../model-resolver.js";
import { createProposeTools } from "../tools/proposeTools.js";
import { createReadTools } from "../tools/readTools.js";
import type { ServiceContext } from "../types.js";

/** 創作相談チャットのツールループ最大ステップ数 */
export const CHAT_MAX_STEPS = 8;

/** 進捗データパーツ（data-progress）の data 部。step は start 時 0、ステップ進行時は 1 始まり */
export interface ChatProgressData {
  finishReason?: string;
  maxSteps: number;
  phase: "start" | "step-start" | "step-finish" | "done";
  step: number;
}

/** 進捗データパーツ。transient 付きのためクライアントへは配信されるがメッセージ parts には保存されない */
export interface ChatProgressPart {
  data: ChatProgressData;
  transient: true;
  type: "data-progress";
}

/**
 * ツール群（読み取りツール ＋ 設定提案ツール）を構築する（ツール対象は小説コンテキストがある場合のみ）。
 * 構築に失敗してもチャット自体は継続させる（RAG フォールバック方針に倣う）。
 */
export function buildChatTools(
  ctx: ServiceContext,
  effectiveNovelId: string | null | undefined
): ToolSet | undefined {
  if (!effectiveNovelId) {
    return undefined;
  }
  try {
    const readTools = createReadTools(ctx, effectiveNovelId);
    const proposeTools = createProposeTools(ctx, effectiveNovelId);
    return { ...readTools, ...proposeTools } as ToolSet;
  } catch {
    // ツール構築失敗時はツールなしで継続
    return undefined;
  }
}

/**
 * 生の StreamTextResult を取得（接続時リトライ付き）し、UI Message Stream レスポンスへ変換する。
 * モデルストリームに加えて data-progress データパーツ（transient、永続化対象外）を出力する。
 * 完了時（正常終了・クライアント中断の両方）に assistant メッセージを永続化する。
 */
export async function streamChatAssistantResponse(
  ctx: ServiceContext,
  sessionId: string,
  resolvedModel: ResolvedLLMModel,
  prompt: string,
  tools: ToolSet | undefined,
  providerOptions: ProviderOptions | undefined
): Promise<Response> {
  let lastStep = 0;
  let writeProgressPart: ((part: ChatProgressPart) => void) | undefined;

  const result = await streamTextResult(resolvedModel.model, prompt, {
    onStep: (progress) => {
      lastStep = progress.step;
      writeProgressPart?.({
        data: { ...progress, maxSteps: CHAT_MAX_STEPS },
        transient: true,
        type: "data-progress",
      });
    },
    providerOptions,
    stopWhen: isStepCount(CHAT_MAX_STEPS),
    tools,
  });

  let assistantSaved = false;
  const uiStream = toUIMessageStream({
    onEnd: async ({ responseMessage }) => {
      if (assistantSaved) {
        return;
      }
      assistantSaved = true;
      const fullText = responseMessage.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text?: string }).text ?? "")
        .join("");
      try {
        const hasMeaningfulContent =
          fullText.trim() !== "" ||
          (responseMessage.parts &&
            responseMessage.parts.length > 0 &&
            responseMessage.parts.some(
              (p) => p.type !== "text" || (p.text && p.text.trim().length > 0)
            ));

        if (!hasMeaningfulContent) {
          return;
        }

        const savedParts =
          responseMessage.parts && responseMessage.parts.length > 0
            ? JSON.parse(JSON.stringify(responseMessage.parts))
            : [{ text: fullText, type: "text" }];

        await ctx.db.insert(chatMessages).values({
          content: fullText,
          parts: savedParts,
          role: "assistant",
          sessionId,
        });
        await ctx.db
          .update(chatSessions)
          .set({ updatedAt: new Date() })
          .where(eq(chatSessions.id, sessionId));
      } catch {
        // ベストエフォート保存: 永続化失敗はストリームを中断しない
      }
    },
    onError: (error) => {
      appLogger.error("[Chat Stream Error]", error);
      return formatErrorMessage(error);
    },
    stream: result.stream,
    tools,
  });

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        writeProgressPart = (part) => {
          writer.write(part);
        };
        writeProgressPart({
          data: { maxSteps: CHAT_MAX_STEPS, phase: "start", step: 0 },
          transient: true,
          type: "data-progress",
        });

        const reader = uiStream.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            writer.write(value);
          }
        } finally {
          reader.releaseLock();
        }

        writeProgressPart({
          data: {
            maxSteps: CHAT_MAX_STEPS,
            phase: "done",
            step: lastStep,
          },
          transient: true,
          type: "data-progress",
        });
      },
      onError: (error) => formatErrorMessage(error),
    }),
  });
}
