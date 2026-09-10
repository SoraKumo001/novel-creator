import {
  buildReasoningProviderOptions,
  type ProviderOptions,
} from "@novel-creator/llm";
import type { ToolSet } from "ai";
import type { z } from "zod";
import { appLogger } from "../middleware/logger.js";
import type { chatRequestSchema } from "../schemas/index.js";
import {
  buildChatContextPrompt,
  type ChatContextResult,
} from "./chat/chat-context.js";
import { extractChatEntitiesFromText } from "./chat/chat-entities.js";
import {
  createChatSession,
  deleteChatSession,
  ensureChatSession,
  getChatSessionWithMessages,
  listChatSessions,
  persistChatUserMessage,
  updateChatSession,
} from "./chat/chat-sessions.js";
import {
  buildChatTools as buildChatToolsImpl,
  CHAT_MAX_STEPS,
  type ChatProgressData,
  type ChatProgressPart,
  streamChatAssistantResponse,
} from "./chat/chat-stream.js";
import {
  type ResolvedLLMModel,
  resolveLLMModelWithInfo,
} from "./model-resolver.js";
import type { ServiceContext } from "./types.js";

export { CHAT_MAX_STEPS, type ChatProgressData, type ChatProgressPart };

/**
 * OpenCode 互換エンドポイント（Console Go 等）へルーティングされているかを判定する。
 * provider ラベルが "openai" のまま baseURL だけ Console Go を指す
 * デフォルトLLM（環境変数）構成でも検出できるよう、baseURL も見る。
 */
function isOpenCodeRoutedEndpoint(baseUrl: string | null | undefined): boolean {
  return (
    baseUrl !== null &&
    baseUrl !== undefined &&
    /opencode|console-?go/i.test(baseUrl)
  );
}

/** TEMP DEBUG 用に baseUrl のホスト部のみを取り出す（キーやパスは出さない）。 */
function hostOf(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) {
    return null;
  }
  try {
    return new URL(baseUrl).host;
  } catch {
    return "(invalid-url)";
  }
}

export class ChatDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listChatSessions(novelId?: string) {
    return listChatSessions(this.ctx, novelId);
  }

  async getChatSessionWithMessages(id: string) {
    return getChatSessionWithMessages(this.ctx, id);
  }

  async createChatSession(data: {
    novelId?: string | null;
    title?: string;
    messages?: { role: "user" | "assistant"; content: string }[];
  }) {
    return createChatSession(this.ctx, data);
  }

  async updateChatSession(id: string, data: { title?: string }) {
    return updateChatSession(this.ctx, id, data);
  }

  async deleteChatSession(id: string) {
    return deleteChatSession(this.ctx, id);
  }

  async extractEntities(text: string) {
    return extractChatEntitiesFromText(this.ctx, text);
  }

  /**
   * 創作相談チャットを AI SDK の UI Message Stream 形式でストリーミング生成する。
   * - リクエストの messages から最後の role='user' メッセージのみを採用し、DB に永続化する。
   * - 会話履歴はサーバー DB を正史とし、DB 履歴（ユーザーメッセージ挿入後）からプロンプトを構築する。
   * - RAG 検索・小説取得失敗時は warnings に記録し空コンテキストで継続する。
   * - 要求 novelId とセッションの novelId が両方あり不一致の場合は 400 相当で拒否する。
   */
  async streamCreativeChat(input: {
    sessionId: string;
    novelId?: string | null;
    messages: z.infer<typeof chatRequestSchema>["messages"];
    modelConfigId?: string | null;
  }): Promise<Response> {
    const { sessionId, novelId, messages, modelConfigId } = input;

    const session = await this.ensureSession(sessionId);
    const { userText } = await this.persistUserMessage(sessionId, messages);

    const effectiveNovelId = novelId ?? session.novelId;
    const [context, resolvedModel]: [ChatContextResult, ResolvedLLMModel] =
      await Promise.all([
        this.buildChatContext(
          sessionId,
          effectiveNovelId,
          userText,
          session.novelId
        ),
        resolveLLMModelWithInfo(this.ctx, modelConfigId, "throw"),
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

    const tools = this.buildChatTools(effectiveNovelId);

    // OpenCode 互換エンドポイント（custom_openai）はリクエスト単位で
    // セッション引継ぎヘッダーを要求する。他プロバイダには送らない。
    // デフォルトLLM（環境変数）では provider が "openai" のまま
    // baseURL だけ Console Go 等を指す構成があり得るため、baseURL も判定する。
    // 行の baseUrl が空でも transport は env LLM_BASE_URL にフォールバックする
    // （provider.ts resolveSettings と同一順）ため、判定も実効 URL で行う。
    const effectiveBaseUrl =
      resolvedModel.baseUrl ?? this.ctx.env.LLM_BASE_URL ?? null;
    const headers =
      resolvedModel.provider === "custom_openai" ||
      isOpenCodeRoutedEndpoint(effectiveBaseUrl)
        ? { "x-opencode-session": sessionId }
        : undefined;
    // TEMP DEBUG: OpenCode ヘッダー付与の判定確認用（確認後に削除する）。
    // info（stdout）で出す。debug は console.debug（stderr）経由で、
    // ターミナルによっては見落とされるため。
    appLogger.info("[TEMP DEBUG] chat headers", {
      baseUrlHost: hostOf(effectiveBaseUrl),
      headerAttached: headers !== undefined,
      provider: resolvedModel.provider,
    });

    const response = await this.streamAssistantResponse(
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

  private async ensureSession(sessionId: string) {
    return ensureChatSession(this.ctx, sessionId);
  }

  private async persistUserMessage(
    sessionId: string,
    messages: z.infer<typeof chatRequestSchema>["messages"]
  ) {
    return persistChatUserMessage(this.ctx, sessionId, messages);
  }

  private async buildChatContext(
    sessionId: string,
    effectiveNovelId: string | null | undefined,
    userText: string,
    sessionNovelId?: string | null
  ): Promise<ChatContextResult> {
    return buildChatContextPrompt(
      this.ctx,
      sessionId,
      effectiveNovelId,
      userText,
      sessionNovelId
    );
  }

  private buildChatTools(
    effectiveNovelId: string | null | undefined
  ): ToolSet | undefined {
    return buildChatToolsImpl(this.ctx, effectiveNovelId);
  }

  private async streamAssistantResponse(
    sessionId: string,
    resolvedModel: ResolvedLLMModel,
    prompt: string,
    tools: ToolSet | undefined,
    providerOptions?: ProviderOptions | undefined,
    headers?: Record<string, string>
  ): Promise<Response> {
    return streamChatAssistantResponse(
      this.ctx,
      sessionId,
      resolvedModel,
      prompt,
      tools,
      providerOptions,
      headers
    );
  }
}
