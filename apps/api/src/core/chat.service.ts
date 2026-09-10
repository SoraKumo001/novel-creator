import type { z } from "zod";
import type { chatRequestSchema } from "../schemas/index.js";
import { extractChatEntitiesFromText } from "./chat/chat-entities.js";
import {
  type StreamCreativeChatInput,
  streamCreativeChatOp,
} from "./chat/chat-operations.js";
import {
  createChatSession,
  deleteChatSession,
  getChatSessionWithMessages,
  listChatSessions,
  updateChatSession,
} from "./chat/chat-sessions.js";
import {
  CHAT_MAX_STEPS,
  type ChatProgressData,
  type ChatProgressPart,
} from "./chat/chat-stream.js";
import type { ServiceContext } from "./types.js";

export {
  CHAT_MAX_STEPS,
  type ChatProgressData,
  type ChatProgressPart,
  type StreamCreativeChatInput,
};

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
    return streamCreativeChatOp(this.ctx, input);
  }
}
