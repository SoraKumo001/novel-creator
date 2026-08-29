import type { z } from 'zod';
import { desc, eq, isNull } from 'drizzle-orm';
import { chatMessages, chatSessions, novels } from '@novel-creator/db';
import {
  creativeChatSystemPrompt,
  extractChatEntities,
  generateText,
  streamText,
} from '@novel-creator/llm';
import { searchContext } from '../rag.js';
import { chatRequestSchema } from '../schemas/index.js';
import { NotFoundError, type ServiceContext } from './types.js';

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
    } = { characters: [], settings: [] };

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
        };
      }
    } catch {
      parsed = { characters: [], settings: [] };
    }

    return {
      characters: (parsed.characters ?? []).map((c) => ({
        name: c.name,
        category: c.category ?? '',
        description: c.description ?? '',
        traits: c.traits ?? [],
      })),
      settings: (parsed.settings ?? []).map((s) => ({
        name: s.name,
        category: s.category ?? '',
        description: s.description ?? '',
      })),
    };
  }

  /**
   * 創作相談チャットを SSE 形式でストリーミング生成する。
   * RAG 検索・小説取得失敗時は空コンテキストで継続する。
   */
  async *streamCreativeChat(input: {
    novelId?: string | null;
    messages: z.infer<typeof chatRequestSchema>['messages'];
  }): AsyncGenerator<string> {
    const { novelId, messages } = input;

    let contextSettings: string[] = [];
    let contextCharacters: string[] = [];
    let novelInfo: { title: string; description?: string | null } | undefined;

    if (novelId) {
      try {
        const [novel] = await this.ctx.db
          .select({ title: novels.title, description: novels.description })
          .from(novels)
          .where(eq(novels.id, novelId));
        if (novel) {
          novelInfo = {
            title: novel.title,
            description: novel.description,
          };
        }

        const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
        if (lastUserMessage) {
          const ragContext = await searchContext(
            this.ctx.vectorStore,
            this.ctx.embedding,
            novelId,
            { query: lastUserMessage.content },
            this.ctx.env,
          );
          contextSettings = ragContext.settings;
          contextCharacters = ragContext.characters;
        }
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
      ...messages.map((m) => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.content}`),
    ].join('\n\n');

    yield* streamText(this.ctx.llm, prompt);
  }
}
