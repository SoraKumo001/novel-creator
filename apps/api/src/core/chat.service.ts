import { chatMessages, chatSessions, novels } from "@novel-creator/db";
import {
  creativeChatSystemPrompt,
  extractChatEntities,
  generateText,
  streamTextResult,
} from "@novel-creator/llm";
import type { LanguageModel, ToolSet } from "ai";
import {
  createUIMessageStreamResponse,
  isStepCount,
  toUIMessageStream,
} from "ai";
import { desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { formatErrorMessage } from "../middleware/error-handler.js";
import { searchContext } from "../rag.js";
import type { chatRequestSchema } from "../schemas/index.js";
import { resolveLLMModel } from "./model-resolver.js";
import { createProposeTools } from "./tools/proposeTools.js";
import { createReadTools } from "./tools/readTools.js";
import {
  NotFoundError,
  type ServiceContext,
  ValidationError,
} from "./types.js";

export class ChatDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listChatSessions(novelId?: string) {
    return novelId
      ? this.ctx.db
          .select()
          .from(chatSessions)
          .where(eq(chatSessions.novelId, novelId))
          .orderBy(desc(chatSessions.updatedAt))
      : this.ctx.db
          .select()
          .from(chatSessions)
          .where(isNull(chatSessions.novelId))
          .orderBy(desc(chatSessions.updatedAt));
  }

  async getChatSessionWithMessages(id: string) {
    const [session] = await this.ctx.db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, id));
    if (!session) {
      throw new NotFoundError("Chat session not found");
    }
    const messages = await this.ctx.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, id))
      .orderBy(chatMessages.createdAt);

    return {
      messages,
      session,
    };
  }

  async createChatSession(data: {
    novelId?: string | null;
    title?: string;
    messages?: { role: "user" | "assistant"; content: string }[];
  }) {
    const [session] = await this.ctx.db
      .insert(chatSessions)
      .values({
        novelId: data.novelId || null,
        title: data.title?.trim() || "新しい相談",
      })
      .returning();

    if (data.messages && data.messages.length > 0) {
      await this.ctx.db.insert(chatMessages).values(
        data.messages.map((m) => ({
          content: m.content,
          role: m.role,
          sessionId: session.id,
        }))
      );
    }

    return session;
  }

  async updateChatSession(id: string, data: { title?: string }) {
    const [updated] = await this.ctx.db
      .update(chatSessions)
      .set({
        ...(data.title ? { title: data.title.trim() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Chat session not found");
    }

    return updated;
  }

  async deleteChatSession(id: string) {
    const [deleted] = await this.ctx.db
      .delete(chatSessions)
      .where(eq(chatSessions.id, id))
      .returning();
    if (!deleted) {
      throw new NotFoundError("Chat session not found");
    }
    return deleted;
  }

  async extractEntities(text: string) {
    const prompt = extractChatEntities(text);
    const rawResult = await generateText(this.ctx.llm, prompt);

    let parsed: {
      characters?: {
        name: string;
        category?: string;
        description?: string;
        traits?: string[];
      }[];
      settings?: { name: string; category?: string; description?: string }[];
      foreshadowings?: {
        title: string;
        description?: string;
        status?: "unresolved" | "resolved" | "abandoned";
      }[];
      timelines?: { event: string; timestamp?: string }[];
      plots?: { title: string; summary?: string }[];
    } = {
      characters: [],
      foreshadowings: [],
      plots: [],
      settings: [],
      timelines: [],
    };

    try {
      const jsonStr = rawResult
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const resultObj = JSON.parse(jsonStr);
      if (resultObj && typeof resultObj === "object") {
        parsed = {
          characters: Array.isArray(resultObj.characters)
            ? resultObj.characters
            : [],
          foreshadowings: Array.isArray(resultObj.foreshadowings)
            ? resultObj.foreshadowings
            : [],
          plots: Array.isArray(resultObj.plots) ? resultObj.plots : [],
          settings: Array.isArray(resultObj.settings) ? resultObj.settings : [],
          timelines: Array.isArray(resultObj.timelines)
            ? resultObj.timelines
            : [],
        };
      }
    } catch {
      parsed = {
        characters: [],
        foreshadowings: [],
        plots: [],
        settings: [],
        timelines: [],
      };
    }

    const cleanLabel = (str?: string) =>
      (str ?? "")
        .replace(
          /[（(【][\s\u3000]*(?:既存|新規|既存キャラ|新規キャラ|既存設定|新規設定|既存情報|新規案|既存人物|新規人物)[\s\u3000]*[）)】]/gi,
          ""
        )
        .trim();

    return {
      characters: (parsed.characters ?? []).map((c) => ({
        category: cleanLabel(c.category),
        description: c.description ?? "",
        name: cleanLabel(c.name),
        traits: c.traits ?? [],
      })),
      foreshadowings: (parsed.foreshadowings ?? []).map((f) => ({
        description: f.description ?? "",
        status:
          f.status === "resolved" || f.status === "abandoned"
            ? f.status
            : "unresolved",
        title: cleanLabel(f.title),
      })),
      plots: (parsed.plots ?? []).map((p) => ({
        summary: p.summary ?? "",
        title: cleanLabel(p.title),
      })),
      settings: (parsed.settings ?? []).map((s) => ({
        category: cleanLabel(s.category),
        description: s.description ?? "",
        name: cleanLabel(s.name),
      })),
      timelines: (parsed.timelines ?? []).map((t) => ({
        event: cleanLabel(t.event),
        timestamp: t.timestamp ?? "",
      })),
    };
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

    // セッション存在確認（404）
    const session = await this.ensureSession(sessionId);

    // ストリーム開始前: 最後の role='user' メッセージのみを採用して永続化
    const { userText } = await this.persistUserMessage(sessionId, messages);

    // 会話履歴（サーバー DB 正史）と RAG コンテキストからプロンプトを構築
    const effectiveNovelId = novelId ?? session.novelId;
    const prompt = await this.buildChatContext(
      sessionId,
      effectiveNovelId,
      userText
    );

    // 使用する LLM モデルを解決（modelConfigId 指定 or デフォルト設定 or 環境変数）。
    // ユーザー指定の modelConfigId が存在しない場合は黙って別モデルへ
    // フォールバックさせずエラーにする（'throw'）。
    const llmModel = await resolveLLMModel(this.ctx, modelConfigId, "throw");

    // ツール群（読み取りツール ＋ 設定提案ツール）を構築する
    const tools = this.buildChatTools(effectiveNovelId);

    // ストリームを生成し、完了時に assistant メッセージを永続化する
    return this.streamAssistantResponse(sessionId, llmModel, prompt, tools);
  }

  /**
   * チャットセッションを取得する。存在しない場合は 404 相当の NotFoundError を投げる。
   */
  private async ensureSession(sessionId: string) {
    const [session] = await this.ctx.db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId));
    if (!session) {
      throw new NotFoundError("Chat session not found");
    }
    return session;
  }

  /**
   * リクエストの messages から最後の role='user' メッセージのみを採用し、
   * ストリーム開始前に DB へ永続化してセッションの updatedAt を更新する。
   * user メッセージが存在しない場合は ValidationError を投げる。
   */
  private async persistUserMessage(
    sessionId: string,
    messages: z.infer<typeof chatRequestSchema>["messages"]
  ) {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUserMessage) {
      throw new ValidationError("No user message provided");
    }
    const userText = lastUserMessage.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { text?: string }).text ?? "")
      .join("");

    await this.ctx.db.insert(chatMessages).values({
      content: userText,
      parts: lastUserMessage.parts,
      role: "user",
      sessionId,
    });
    await this.ctx.db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));

    return { userText };
  }

  /**
   * 会話履歴（サーバー DB 正史・ユーザーメッセージ挿入後）と小説情報・RAG 検索結果から
   * LLM へ渡すプロンプトを構築する。
   * RAG 検索・小説取得失敗時は空コンテキストで継続する。
   */
  private async buildChatContext(
    sessionId: string,
    effectiveNovelId: string | null | undefined,
    userText: string
  ) {
    const history = await this.ctx.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);

    // RAG コンテキスト構築（現状維持）
    let contextSettings: string[] = [];
    let contextCharacters: string[] = [];
    let novelInfo:
      | {
          title: string;
          description?: string | null;
          styleGuide?: string | null;
        }
      | undefined;

    if (effectiveNovelId) {
      try {
        const [novel] = await this.ctx.db
          .select({
            description: novels.description,
            styleGuide: novels.styleGuide,
            title: novels.title,
          })
          .from(novels)
          .where(eq(novels.id, effectiveNovelId));
        if (novel) {
          novelInfo = {
            description: novel.description,
            styleGuide: novel.styleGuide,
            title: novel.title,
          };
        }

        const ragContext = await searchContext(
          this.ctx.vectorStore,
          this.ctx.embedding,
          effectiveNovelId,
          { query: userText },
          this.ctx.env
        );
        contextSettings = ragContext.settings;
        contextCharacters = ragContext.characters;
      } catch {
        // RAG 検索・小説取得失敗時は空コンテキストで継続
      }
    }

    const systemPrompt = creativeChatSystemPrompt({
      characters: contextCharacters,
      novel: novelInfo,
      settings: contextSettings,
    });

    return [
      systemPrompt,
      ...history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map(
          (m) =>
            `${m.role === "user" ? "ユーザー" : "アシスタント"}: ${m.content}`
        ),
    ].join("\n\n");
  }

  /**
   * ツール群（読み取りツール ＋ 設定提案ツール）を構築する（ツール対象は小説コンテキストがある場合のみ）。
   * 構築に失敗してもチャット自体は継続させる（RAG フォールバック方針に倣う）。
   */
  private buildChatTools(
    effectiveNovelId: string | null | undefined
  ): ToolSet | undefined {
    if (!effectiveNovelId) {
      return undefined;
    }
    try {
      const readTools = createReadTools(this.ctx, effectiveNovelId);
      const proposeTools = createProposeTools(this.ctx, effectiveNovelId);
      return { ...readTools, ...proposeTools } as ToolSet;
    } catch {
      // ツール構築失敗時はツールなしで継続
      return undefined;
    }
  }

  /**
   * 生の StreamTextResult を取得（接続時リトライ付き）し、UI Message Stream レスポンスへ変換する。
   * 完了時（正常終了・クライアント中断の両方）に assistant メッセージを永続化する。
   * onEnd は flush / cancel のいずれかで必ず一度だけ呼ばれるため、二重保存防止フラグで保護する。
   */
  private async streamAssistantResponse(
    sessionId: string,
    llmModel: LanguageModel,
    prompt: string,
    tools: ToolSet | undefined
  ): Promise<Response> {
    const result = await streamTextResult(llmModel, prompt, {
      stopWhen: isStepCount(8),
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
          // 思考プロセス（reasoning）やツール呼び出しパーツ（tool-*）を含めた全 parts を保存
          const savedParts =
            responseMessage.parts && responseMessage.parts.length > 0
              ? JSON.parse(JSON.stringify(responseMessage.parts))
              : [{ text: fullText, type: "text" }];

          await this.ctx.db.insert(chatMessages).values({
            content: fullText,
            parts: savedParts,
            role: "assistant",
            sessionId,
          });
          await this.ctx.db
            .update(chatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(chatSessions.id, sessionId));
        } catch {
          // ベストエフォート保存: 永続化失敗はストリームを中断しない
        }
      },
      onError: (error) => {
        console.error("[Chat Stream Error]", error);
        return formatErrorMessage(error);
      },
      stream: result.stream,
      tools,
    });

    return createUIMessageStreamResponse({ stream: uiStream });
  }
}
