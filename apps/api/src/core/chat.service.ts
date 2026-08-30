import type { z } from 'zod';
import { desc, eq, isNull } from 'drizzle-orm';
import { createUIMessageStreamResponse, isStepCount, toUIMessageStream } from 'ai';
import type { ToolSet } from 'ai';
import { chatMessages, chatSessions, llmConfigs, novels } from '@novel-creator/db';
import {
  createLanguageModelFromConfig,
  creativeChatSystemPrompt,
  extractChatEntities,
  generateText,
  streamTextResult,
} from '@novel-creator/llm';

import { searchContext } from '../rag.js';
import { chatRequestSchema } from '../schemas/index.js';
import { formatErrorMessage } from '../middleware/error-handler.js';
import { createReadTools } from './tools/readTools.js';
import { createProposeTools } from './tools/proposeTools.js';
import { NotFoundError, ValidationError, type ServiceContext } from './types.js';

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
    const [session] = await this.ctx.db.select().from(chatSessions).where(eq(chatSessions.id, id));
    if (!session) {
      throw new NotFoundError('Chat session not found');
    }
    const messages = await this.ctx.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, id))
      .orderBy(chatMessages.createdAt);

    return {
      session,
      messages,
    };
  }

  async createChatSession(data: {
    novelId?: string | null;
    title?: string;
    messages?: { role: 'user' | 'assistant'; content: string }[];
  }) {
    const [session] = await this.ctx.db
      .insert(chatSessions)
      .values({
        novelId: data.novelId || null,
        title: data.title?.trim() || '新しい相談',
      })
      .returning();

    if (data.messages && data.messages.length > 0) {
      await this.ctx.db.insert(chatMessages).values(
        data.messages.map((m) => ({
          sessionId: session.id,
          role: m.role,
          content: m.content,
        })),
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
      throw new NotFoundError('Chat session not found');
    }

    return updated;
  }

  async deleteChatSession(id: string) {
    const [deleted] = await this.ctx.db
      .delete(chatSessions)
      .where(eq(chatSessions.id, id))
      .returning();
    if (!deleted) {
      throw new NotFoundError('Chat session not found');
    }
    return deleted;
  }

  async extractEntities(text: string) {
    const prompt = extractChatEntities(text);
    const rawResult = await generateText(this.ctx.llm, prompt);

    let parsed: {
      characters?: { name: string; category?: string; description?: string; traits?: string[] }[];
      settings?: { name: string; category?: string; description?: string }[];
      foreshadowings?: {
        title: string;
        description?: string;
        status?: 'unresolved' | 'resolved' | 'abandoned';
      }[];
      timelines?: { event: string; timestamp?: string }[];
      plots?: { title: string; summary?: string }[];
    } = { characters: [], settings: [], foreshadowings: [], timelines: [], plots: [] };

    try {
      const jsonStr = rawResult
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      const resultObj = JSON.parse(jsonStr);
      if (resultObj && typeof resultObj === 'object') {
        parsed = {
          characters: Array.isArray(resultObj.characters) ? resultObj.characters : [],
          settings: Array.isArray(resultObj.settings) ? resultObj.settings : [],
          foreshadowings: Array.isArray(resultObj.foreshadowings) ? resultObj.foreshadowings : [],
          timelines: Array.isArray(resultObj.timelines) ? resultObj.timelines : [],
          plots: Array.isArray(resultObj.plots) ? resultObj.plots : [],
        };
      }
    } catch {
      parsed = { characters: [], settings: [], foreshadowings: [], timelines: [], plots: [] };
    }

    const cleanLabel = (str?: string) =>
      (str ?? '')
        .replace(
          /[（(【][\s\u3000]*(?:既存|新規|既存キャラ|新規キャラ|既存設定|新規設定|既存情報|新規案|既存人物|新規人物)[\s\u3000]*[）)】]/gi,
          '',
        )
        .trim();

    return {
      characters: (parsed.characters ?? []).map((c) => ({
        name: cleanLabel(c.name),
        category: cleanLabel(c.category),
        description: c.description ?? '',
        traits: c.traits ?? [],
      })),
      settings: (parsed.settings ?? []).map((s) => ({
        name: cleanLabel(s.name),
        category: cleanLabel(s.category),
        description: s.description ?? '',
      })),
      foreshadowings: (parsed.foreshadowings ?? []).map((f) => ({
        title: cleanLabel(f.title),
        description: f.description ?? '',
        status: f.status === 'resolved' || f.status === 'abandoned' ? f.status : 'unresolved',
      })),
      timelines: (parsed.timelines ?? []).map((t) => ({
        event: cleanLabel(t.event),
        timestamp: t.timestamp ?? '',
      })),
      plots: (parsed.plots ?? []).map((p) => ({
        title: cleanLabel(p.title),
        summary: p.summary ?? '',
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
    messages: z.infer<typeof chatRequestSchema>['messages'];
    modelConfigId?: string | null;
  }): Promise<Response> {
    const { sessionId, novelId, messages, modelConfigId } = input;

    // セッション存在確認（404）
    const [session] = await this.ctx.db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId));
    if (!session) {
      throw new NotFoundError('Chat session not found');
    }

    // リクエストの messages から最後の role='user' メッセージのみを採用
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      throw new ValidationError('No user message provided');
    }
    const userText = lastUserMessage.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text?: string }).text ?? '')
      .join('');

    // ストリーム開始前: ユーザーメッセージを永続化
    await this.ctx.db.insert(chatMessages).values({
      sessionId,
      role: 'user',
      content: userText,
      parts: lastUserMessage.parts as unknown,
    });
    await this.ctx.db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));

    // 会話履歴はサーバー DB 正史（ユーザーメッセージ挿入後）
    const history = await this.ctx.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);

    // RAG コンテキスト構築（現状維持）
    let contextSettings: string[] = [];
    let contextCharacters: string[] = [];
    let novelInfo: { title: string; description?: string | null } | undefined;

    const effectiveNovelId = novelId ?? session.novelId;
    if (effectiveNovelId) {
      try {
        const [novel] = await this.ctx.db
          .select({ title: novels.title, description: novels.description })
          .from(novels)
          .where(eq(novels.id, effectiveNovelId));
        if (novel) {
          novelInfo = {
            title: novel.title,
            description: novel.description,
          };
        }

        const ragContext = await searchContext(
          this.ctx.vectorStore,
          this.ctx.embedding,
          effectiveNovelId,
          { query: userText },
          this.ctx.env,
        );
        contextSettings = ragContext.settings;
        contextCharacters = ragContext.characters;
      } catch {
        // RAG 検索・小説取得失敗時は空コンテキストで継続
      }
    }

    const systemPrompt = creativeChatSystemPrompt({
      novel: novelInfo,
      settings: contextSettings,
      characters: contextCharacters,
    });

    const prompt = [
      systemPrompt,
      ...history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.content}`),
    ].join('\n\n');

    // 使用する LLM モデルを解決（modelConfigId 指定 or デフォルト設定 or 環境変数）
    let llmModel = this.ctx.llm;
    if (modelConfigId) {
      const [customConfig] = await this.ctx.db
        .select()
        .from(llmConfigs)
        .where(eq(llmConfigs.id, modelConfigId));
      if (customConfig) {
        llmModel = createLanguageModelFromConfig(customConfig, this.ctx.env);
      }
    } else {
      const [defaultConfig] = await this.ctx.db
        .select()
        .from(llmConfigs)
        .where(eq(llmConfigs.isDefault, true));
      if (defaultConfig) {
        llmModel = createLanguageModelFromConfig(defaultConfig, this.ctx.env);
      }
    }

    // ツール群（読み取りツール ＋ 設定提案ツール）を構築する（ツール対象は小説コンテキストがある場合のみ）。
    // 構築に失敗してもチャット自体は継続させる（RAG フォールバック方針に倣う）。
    let tools: ToolSet | undefined;
    if (effectiveNovelId) {
      try {
        const readTools = createReadTools(this.ctx, effectiveNovelId);
        const proposeTools = createProposeTools(this.ctx, effectiveNovelId);
        tools = { ...readTools, ...proposeTools } as ToolSet;
      } catch {
        // ツール構築失敗時はツールなしで継続
      }
    }

    // 生の StreamTextResult を取得（接続時リトライ付き）
    const result = await streamTextResult(llmModel, prompt, {
      tools,
      stopWhen: isStepCount(8),
    });

    // 完了時（正常終了・クライアント中断の両方）に assistant メッセージを永続化する。
    // onEnd は flush / cancel のいずれかで必ず一度だけ呼ばれるため、二重保存防止フラグで保護する。
    let assistantSaved = false;
    const uiStream = toUIMessageStream({
      stream: result.stream,
      tools,
      onError: (error) => {
        console.error('[Chat Stream Error]', error);
        return formatErrorMessage(error);
      },
      onEnd: async ({ responseMessage }) => {
        if (assistantSaved) return;
        assistantSaved = true;
        const fullText = responseMessage.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { text?: string }).text ?? '')
          .join('');
        try {
          await this.ctx.db.insert(chatMessages).values({
            sessionId,
            role: 'assistant',
            content: fullText,
            parts: [{ type: 'text', text: fullText }] as unknown,
          });
          await this.ctx.db
            .update(chatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(chatSessions.id, sessionId));
        } catch {
          // ベストエフォート保存: 永続化失敗はストリームを中断しない
        }
      },
    });

    return createUIMessageStreamResponse({ stream: uiStream });
  }
}
