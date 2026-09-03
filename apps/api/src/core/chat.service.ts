import {
  buildReasoningProviderOptions,
  type ProviderOptions,
} from "@novel-creator/llm";
import type { ToolSet } from "ai";
import type { z } from "zod";
import type { chatRequestSchema } from "../schemas/index.js";
import { buildChatContextPrompt } from "./chat/chat-context.js";
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
   * - RAG 検索・小説取得失敗時は空コンテキストで継続する。
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
    const prompt = await this.buildChatContext(
      sessionId,
      effectiveNovelId,
      userText
    );

    const resolvedModel = await resolveLLMModelWithInfo(
      this.ctx,
      modelConfigId,
      "throw"
    );

    const providerOptions = buildReasoningProviderOptions(
      resolvedModel.provider,
      resolvedModel.modelId
    );

    const tools = this.buildChatTools(effectiveNovelId);

    return this.streamAssistantResponse(
      sessionId,
      resolvedModel,
      prompt,
      tools,
      providerOptions
    );
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
    userText: string
  ) {
    return buildChatContextPrompt(
      this.ctx,
      sessionId,
      effectiveNovelId,
      userText
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
    providerOptions?: ProviderOptions | undefined
  ): Promise<Response> {
    return streamChatAssistantResponse(
      this.ctx,
      sessionId,
      resolvedModel,
      prompt,
      tools,
      providerOptions
    );
  }
}
