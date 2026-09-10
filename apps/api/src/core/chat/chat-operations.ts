import { buildReasoningProviderOptions } from "@novel-creator/llm";
import type { z } from "zod";
import { appLogger } from "../../middleware/logger.js";
import type { chatRequestSchema } from "../../schemas/index.js";
import {
  buildOpenCodeSessionHeaders,
  type ResolvedLLMModel,
  resolveLLMModelWithInfo,
} from "../model-resolver.js";
import type { ServiceContext } from "../types.js";
import {
  buildChatContextPrompt,
  type ChatContextResult,
} from "./chat-context.js";
import { ensureChatSession, persistChatUserMessage } from "./chat-sessions.js";
import { buildChatTools, streamChatAssistantResponse } from "./chat-stream.js";

export interface StreamCreativeChatInput {
  messages: z.infer<typeof chatRequestSchema>["messages"];
  modelConfigId?: string | null;
  novelId?: string | null;
  sessionId: string;
}

/**
 * 創作相談チャットを AI SDK の UI Message Stream 形式でストリーミング生成する。
 * - リクエストの messages から最後の role='user' メッセージのみを採用し、DB に永続化する。
 * - 会話履歴はサーバー DB を正史とし、DB 履歴（ユーザーメッセージ挿入後）からプロンプトを構築する。
 * - RAG 検索・小説取得失敗時は warnings に記録し空コンテキストで継続する。
 * - 要求 novelId とセッションの novelId が両方あり不一致の場合は 400 相当で拒否する。
 */
export async function streamCreativeChatOp(
  ctx: ServiceContext,
  input: StreamCreativeChatInput
): Promise<Response> {
  const { sessionId, novelId, messages, modelConfigId } = input;

  const session = await ensureChatSession(ctx, sessionId);
  const { userText } = await persistChatUserMessage(ctx, sessionId, messages);

  const effectiveNovelId = novelId ?? session.novelId;
  const [context, resolvedModel]: [ChatContextResult, ResolvedLLMModel] =
    await Promise.all([
      buildChatContextPrompt(
        ctx,
        sessionId,
        effectiveNovelId,
        userText,
        session.novelId
      ),
      resolveLLMModelWithInfo(ctx, modelConfigId, "throw"),
    ]);

  if (context.warnings.length > 0) {
    appLogger.warn("[Chat] context warnings", {
      sessionId,
      warnings: context.warnings,
    });
  }
  const prompt = context.prompt;

  const providerOptions = buildReasoningProviderOptions(
    resolvedModel.provider,
    resolvedModel.modelId
  );

  const tools = buildChatTools(ctx, effectiveNovelId);

  // OpenCode 互換エンドポイント（custom_openai）はリクエスト単位で
  // セッション引継ぎヘッダーを要求する。他プロバイダには送らない。
  // デフォルトLLM（環境変数）では provider が "openai" のまま
  // baseURL だけ Console Go 等を指す構成があり得るため、baseURL も判定する。
  // 行の baseUrl が空でも transport は env LLM_BASE_URL にフォールバックする
  // （provider.ts resolveSettings と同一順）ため、判定も実効 URL で行う。
  const headers = buildOpenCodeSessionHeaders(
    resolvedModel,
    sessionId,
    ctx.env.LLM_BASE_URL
  );

  const response = await streamChatAssistantResponse(
    ctx,
    sessionId,
    resolvedModel,
    prompt,
    tools,
    providerOptions,
    headers
  );

  // warnings は既存ストリーム形式を変えず、レスポンスヘッダでクライアントに返す
  if (context.warnings.length > 0) {
    response.headers.set("X-Context-Warnings", context.warnings.join(","));
  }
  return response;
}
