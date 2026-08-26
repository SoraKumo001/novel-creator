import { desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { StreamingApi } from 'hono/utils/stream';
import { zValidator } from '@hono/zod-validator';

import { characters, chatMessages, chatSessions, novels, settings } from '@novel-creator/db';
import {
  creativeChatSystemPrompt,
  extractChatEntities,
  generateText,
  streamText,
} from '@novel-creator/llm';

import type { AppContext } from '../context.js';
import { searchContext } from '../rag.js';
import {
  chatRequestSchema,
  chatSessionQuerySchema,
  createChatSessionSchema,
  extractChatEntitiesSchema,
  idParamSchema,
  updateChatSessionSchema,
} from '../schemas/index.js';

const chatRouter = new Hono<AppContext>();

// POST /api/chat/extract-entities - チャットテキストから人物・設定を抽出
chatRouter.post('/extract-entities', zValidator('json', extractChatEntitiesSchema), async (c) => {
  const { text } = c.req.valid('json');

  const prompt = extractChatEntities(text);
  const rawResult = await generateText(c.var.llm, prompt);

  let parsed = { characters: [], settings: [] };
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

  return c.json(parsed);
});

// GET /api/chat/sessions - セッション一覧取得
chatRouter.get('/sessions', zValidator('query', chatSessionQuerySchema), async (c) => {
  const db = c.var.db;
  const { novelId } = c.req.valid('query');

  if (novelId) {
    const rows = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.novelId, novelId))
      .orderBy(desc(chatSessions.updatedAt));
    return c.json(rows);
  } else {
    // novelId が指定されていない場合は全セッション（またはnovelIdがnullの全体相談セッション）を取得
    const rows = await db
      .select()
      .from(chatSessions)
      .where(isNull(chatSessions.novelId))
      .orderBy(desc(chatSessions.updatedAt));
    return c.json(rows);
  }
});

// POST /api/chat/sessions - 新規セッション作成
chatRouter.post('/sessions', zValidator('json', createChatSessionSchema), async (c) => {
  const db = c.var.db;
  const { novelId, title } = c.req.valid('json');

  const [session] = await db
    .insert(chatSessions)
    .values({
      novelId: novelId ?? null,
      title: title?.trim() || '新しい相談',
    })
    .returning();

  return c.json(session, 201);
});

// GET /api/chat/sessions/:id - セッション詳細およびメッセージ履歴取得
chatRouter.get('/sessions/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');

  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
  if (!session) {
    return c.json({ error: 'Chat session not found' }, 404);
  }

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, id))
    .orderBy(chatMessages.createdAt);

  return c.json({
    ...session,
    messages,
  });
});

// PUT /api/chat/sessions/:id - セッションタイトル更新
chatRouter.put(
  '/sessions/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateChatSessionSchema),
  async (c) => {
    const db = c.var.db;
    const { id } = c.req.valid('param');
    const { title } = c.req.valid('json');

    const [updated] = await db
      .update(chatSessions)
      .set({
        title: title.trim(),
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, id))
      .returning();

    if (!updated) {
      return c.json({ error: 'Chat session not found' }, 404);
    }

    return c.json(updated);
  },
);

// DELETE /api/chat/sessions/:id - セッション削除
chatRouter.delete('/sessions/:id', zValidator('param', idParamSchema), async (c) => {
  const db = c.var.db;
  const { id } = c.req.valid('param');

  const [deleted] = await db.delete(chatSessions).where(eq(chatSessions.id, id)).returning();

  if (!deleted) {
    return c.json({ error: 'Chat session not found' }, 404);
  }

  return c.json({ success: true });
});

// POST /api/chat - 創作相談チャット (SSE ストリーミング ＆ 自動保存)
chatRouter.post('/', zValidator('json', chatRequestSchema), async (c) => {
  const db = c.var.db;
  const { sessionId, novelId, messages } = c.req.valid('json');

  let systemPrompt: string;
  if (novelId) {
    const [novel] = await db.select().from(novels).where(eq(novels.id, novelId));
    if (novel) {
      const [novelSettings, novelCharacters] = await Promise.all([
        db.select().from(settings).where(eq(settings.novelId, novelId)),
        db.select().from(characters).where(eq(characters.novelId, novelId)),
      ]);

      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
      let ragContext: { characters: string[]; settings: string[] } = {
        characters: [],
        settings: [],
      };

      if (lastUserMessage.trim()) {
        try {
          ragContext = await searchContext(
            c.var.vectorStore,
            c.var.embedding,
            novelId,
            { query: lastUserMessage, topK: 3 },
            c.var.env,
          );
        } catch {
          // ベクトル検索でエラーが起きてもチャットは継続
        }
      }

      const settingsList = novelSettings.map(
        (s) => `[${s.category}] ${s.name}: ${s.description ?? ''}`,
      );
      const charactersList = novelCharacters.map(
        (ch) =>
          `[${ch.category ?? '未分類'}] ${ch.name}: ${ch.description ?? ''}${ch.traits?.length ? ` (特徴: ${ch.traits.join(', ')})` : ''}`,
      );

      const additionalContext = [
        ...ragContext.settings.map((s) => `【関連設定】${s}`),
        ...ragContext.characters.map((c) => `【関連人物】${c}`),
      ];

      systemPrompt = creativeChatSystemPrompt({
        novel: {
          title: novel.title,
          description: novel.description,
        },
        settings: settingsList,
        characters: charactersList,
        additionalContext: additionalContext.length > 0 ? additionalContext : undefined,
      });
    } else {
      systemPrompt = creativeChatSystemPrompt();
    }
  } else {
    systemPrompt = creativeChatSystemPrompt();
  }

  // 会話履歴をフォーマット
  const historyText = messages
    .map((m) => {
      const roleName = m.role === 'user' ? '作家（ユーザー）' : 'アシスタント（AI）';
      return `${roleName}:\n${m.content}`;
    })
    .join('\n\n');

  const fullPrompt = `${systemPrompt}\n\n# これまでの対話履歴\n${historyText}\n\nアシスタント（AI）:`;

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');

  // セッションがある場合、送信されたユーザーメッセージをDBに保存（まだ保存されていない場合）
  if (sessionId && lastUserMsg) {
    try {
      await db.insert(chatMessages).values({
        sessionId,
        role: 'user',
        content: lastUserMsg.content,
      });

      // セッションのタイトルがデフォルトなら最初のユーザーメッセージから自動更新
      const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId));
      if (session && (session.title === '新しい相談' || !session.title)) {
        const autoTitle = lastUserMsg.content.slice(0, 30).trim().replace(/\n+/g, ' ');
        if (autoTitle) {
          await db
            .update(chatSessions)
            .set({ title: autoTitle, updatedAt: new Date() })
            .where(eq(chatSessions.id, sessionId));
        }
      }
    } catch {
      // DB保存失敗時もストリーミング自体は継続
    }
  }

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  return stream(c, async (s: StreamingApi) => {
    let aiResponseText = '';
    try {
      for await (const chunk of streamText(c.var.llm, fullPrompt)) {
        aiResponseText += chunk;
        await s.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      // ストリーミング完了時、AIメッセージをDBに保存
      if (sessionId && aiResponseText.trim()) {
        try {
          await db.insert(chatMessages).values({
            sessionId,
            role: 'assistant',
            content: aiResponseText,
          });
          await db
            .update(chatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(chatSessions.id, sessionId));
        } catch {
          // 保存失敗は無視
        }
      }

      await s.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during streaming';
      await s.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
    }
  });
});

export default chatRouter;
