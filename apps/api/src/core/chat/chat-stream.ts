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
export const CHAT_MAX_STEPS = 4;

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
 * 構築に失敗した場合は警告ログを残し、ツールなしで継続する（呼び出し元は warnings で UI 通知可能）。
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
  } catch (err) {
    // ツール構築失敗時はツールなしで継続（沈黙させず警告ログを残す）
    appLogger.warn("[Chat Tools] build failed, continuing without tools", err);
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
  let assistantSaveError: string | undefined;
  const uiStream = toUIMessageStream({
    onEnd: async ({ responseMessage }) => {
      if (assistantSaved) {
        return;
      }
      assistantSaved = true;
      const parts = Array.isArray(responseMessage.parts)
        ? responseMessage.parts
        : [];
      const fullText = parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text?: string }).text ?? "")
        .join("");
      try {
        const hasMeaningfulContent =
          fullText.trim() !== "" ||
          (parts.length > 0 &&
            parts.some(
              (p) => p.type !== "text" || (p.text && p.text.trim().length > 0)
            ));

        if (!hasMeaningfulContent) {
          return;
        }

        const savedParts =
          parts.length > 0
            ? (JSON.parse(JSON.stringify(parts)) as unknown)
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
      } catch (err) {
        // 永続化失敗はストリームを中断しないが、握り潰さずログ＋末尾警告で通知する
        appLogger.error(
          "[Chat Stream] Failed to persist assistant message",
          err
        );
        assistantSaveError = err instanceof Error ? err.message : String(err);
        try {
          writeProgressPart?.({
            data: {
              finishReason: "save-failed",
              maxSteps: CHAT_MAX_STEPS,
              phase: "done",
              step: lastStep,
            },
            transient: true,
            type: "data-progress",
          });
        } catch {
          // 警告パートの送出自体はベストエフォート
        }
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
            finishReason: assistantSaveError ? "save-failed" : undefined,
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
