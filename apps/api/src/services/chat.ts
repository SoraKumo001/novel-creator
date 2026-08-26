import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { desc, eq, isNull } from 'drizzle-orm';
import { chatMessages, chatSessions } from '@novel-creator/db';
import { extractChatEntities, generateText } from '@novel-creator/llm';
import { ChatService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';

function formatChatSession(row: typeof chatSessions.$inferSelect) {
  return {
    id: row.id,
    novelId: row.novelId ?? undefined,
    title: row.title,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

export function registerChatService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(ChatService, {
    async listChatSessions(req) {
      const db = getContext().db;
      const rows = req.novelId
        ? await db
            .select()
            .from(chatSessions)
            .where(eq(chatSessions.novelId, req.novelId))
            .orderBy(desc(chatSessions.updatedAt))
        : await db
            .select()
            .from(chatSessions)
            .where(isNull(chatSessions.novelId))
            .orderBy(desc(chatSessions.updatedAt));

      return {
        sessions: rows.map(formatChatSession),
      };
    },

    async getChatSession(req) {
      const db = getContext().db;
      const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, req.id));
      if (!session) {
        throw new ConnectError('Chat session not found', Code.NotFound);
      }
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, req.id))
        .orderBy(chatMessages.createdAt);

      return {
        session: formatChatSession(session),
        messages: messages.map((m) => ({
          id: m.id,
          sessionId: m.sessionId,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt ? m.createdAt.toISOString() : undefined,
        })),
      };
    },

    async createChatSession(req) {
      const db = getContext().db;
      const [session] = await db
        .insert(chatSessions)
        .values({
          novelId: req.novelId || null,
          title: req.title.trim() || '新しい相談',
        })
        .returning();

      if (req.messages.length > 0) {
        await db.insert(chatMessages).values(
          req.messages.map((m) => ({
            sessionId: session.id,
            role: m.role,
            content: m.content,
          })),
        );
      }

      return formatChatSession(session);
    },

    async updateChatSession(req) {
      const db = getContext().db;
      const [updated] = await db
        .update(chatSessions)
        .set({
          ...(req.title ? { title: req.title.trim() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(chatSessions.id, req.id))
        .returning();

      if (!updated) {
        throw new ConnectError('Chat session not found', Code.NotFound);
      }

      return formatChatSession(updated);
    },

    async deleteChatSession(req) {
      const db = getContext().db;
      const [deleted] = await db
        .delete(chatSessions)
        .where(eq(chatSessions.id, req.id))
        .returning();
      if (!deleted) {
        throw new ConnectError('Chat session not found', Code.NotFound);
      }
      return { success: true };
    },

    async extractEntities(req) {
      const ctx = getContext();
      const prompt = extractChatEntities(req.text);
      const rawResult = await generateText(ctx.llm, prompt);

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
    },
  });
}
