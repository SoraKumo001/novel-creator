import { eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import {
  chapters,
  chatMessages,
  chatSessions,
  characters,
  contents,
  llmInstructions,
  novels,
  sections,
  settings,
  timelines,
  type NewChapter,
  type NewCharacter,
  type NewChatMessage,
  type NewChatSession,
  type NewContent,
  type NewLlmInstruction,
  type NewNovel,
  type NewSection,
  type NewSetting,
  type NewTimeline,
} from '@novel-creator/db';

import type { AppContext } from '../context.js';

const backupRouter = new Hono<AppContext>();

// エクスポート用クエリパラメータのバリデーション。
const exportQuerySchema = z.object({
  novelId: z.string().uuid(),
});

// インポート用ボディの緩い型。
// 行は動的な形状を持つため、必要最小限の構造のみを保持する。
interface BackupBody {
  meta: {
    version: number;
    novelId: string;
  };
  rdb: {
    novel: NewNovel;
    chapters?: NewChapter[];
    sections?: NewSection[];
    contents?: NewContent[];
    characters?: NewCharacter[];
    settings?: NewSetting[];
    timelines?: NewTimeline[];
    llmInstructions?: NewLlmInstruction[];
    chatSessions?: NewChatSession[];
    chatMessages?: NewChatMessage[];
  };
}

// POST /api/backup/export?novelId=...
backupRouter.post('/export', zValidator('query', exportQuerySchema), async (c) => {
  const db = c.var.db;
  const { novelId } = c.req.valid('query');

  // 1. novel 本体
  const [novel] = await db.select().from(novels).where(eq(novels.id, novelId));
  if (!novel) return c.json({ error: 'Novel not found' }, 404);

  // 2. chapters
  const chapterRows = await db.select().from(chapters).where(eq(chapters.novelId, novelId));

  // 3. sections (chapterId IN ...)
  const chapterIds = chapterRows.map((ch) => ch.id);
  const sectionRows =
    chapterIds.length > 0
      ? await db.select().from(sections).where(inArray(sections.chapterId, chapterIds))
      : [];

  // 4. contents (sectionId IN ...)
  const sectionIds = sectionRows.map((s) => s.id);
  const contentRows =
    sectionIds.length > 0
      ? await db.select().from(contents).where(inArray(contents.sectionId, sectionIds))
      : [];

  // 5-8. novelId 直接参照のテーブル
  const [characterRows, settingRows, timelineRows, llmInstructionRows] = await Promise.all([
    db.select().from(characters).where(eq(characters.novelId, novelId)),
    db.select().from(settings).where(eq(settings.novelId, novelId)),
    db.select().from(timelines).where(eq(timelines.novelId, novelId)),
    db.select().from(llmInstructions).where(eq(llmInstructions.novelId, novelId)),
  ]);

  // 9-10. chatSessions + chatMessages
  const chatSessionRows = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.novelId, novelId));
  const sessionIds = chatSessionRows.map((s) => s.id);
  const chatMessageRows =
    sessionIds.length > 0
      ? await db.select().from(chatMessages).where(inArray(chatMessages.sessionId, sessionIds))
      : [];

  return c.json({
    meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      novelId: novel.id,
      novelTitle: novel.title,
    },
    rdb: {
      novel,
      chapters: chapterRows,
      sections: sectionRows,
      contents: contentRows,
      characters: characterRows,
      settings: settingRows,
      timelines: timelineRows,
      llmInstructions: llmInstructionRows,
      chatSessions: chatSessionRows,
      chatMessages: chatMessageRows,
    },
  });
});

// POST /api/backup/import
// オーバーライト（TRUNCATE）モード: novel を削除（カスケードで子も削除）してから再挿入する。
backupRouter.post('/import', async (c) => {
  const db = c.var.db;
  const vectorStore = c.var.vectorStore;
  const body = (await c.req.json()) as BackupBody;

  // 最小構造の手動バリデーション
  if (
    !body ||
    typeof body !== 'object' ||
    !body.meta ||
    typeof body.meta.version !== 'number' ||
    typeof body.meta.novelId !== 'string' ||
    !body.rdb ||
    !body.rdb.novel
  ) {
    return c.json({ error: 'Invalid backup file' }, 400);
  }

  const novelId = body.meta.novelId;

  // トランザクション内で削除 → 親→子順に再挿入。
  await db.transaction(async (tx) => {
    // 既存 novel を削除（カスケードで全子データも削除）
    await tx.delete(novels).where(eq(novels.id, novelId));

    // novel 再挿入
    await tx.insert(novels).values(body.rdb.novel);

    // 子テーブルを親→子順に挿入（空配列はスキップ）
    if (body.rdb.chapters?.length) {
      await tx.insert(chapters).values(body.rdb.chapters);
    }
    if (body.rdb.sections?.length) {
      await tx.insert(sections).values(body.rdb.sections);
    }
    if (body.rdb.contents?.length) {
      await tx.insert(contents).values(body.rdb.contents);
    }
    if (body.rdb.characters?.length) {
      await tx.insert(characters).values(body.rdb.characters);
    }
    if (body.rdb.settings?.length) {
      await tx.insert(settings).values(body.rdb.settings);
    }
    if (body.rdb.timelines?.length) {
      await tx.insert(timelines).values(body.rdb.timelines);
    }
    if (body.rdb.llmInstructions?.length) {
      await tx.insert(llmInstructions).values(body.rdb.llmInstructions);
    }
    if (body.rdb.chatSessions?.length) {
      await tx.insert(chatSessions).values(body.rdb.chatSessions);
    }
    if (body.rdb.chatMessages?.length) {
      await tx.insert(chatMessages).values(body.rdb.chatMessages);
    }
  });

  // トランザクション外: 孤立したベクトルを削除（ベストエフォート。失敗しても RDB 復元は成功）
  try {
    await vectorStore.deleteByNovel(novelId);
  } catch (err) {
    console.error('[backup] failed to clean up orphaned vectors', err);
  }

  return c.json({
    success: true,
    novelId,
    counts: {
      chapters: body.rdb.chapters?.length ?? 0,
      sections: body.rdb.sections?.length ?? 0,
      contents: body.rdb.contents?.length ?? 0,
      characters: body.rdb.characters?.length ?? 0,
      settings: body.rdb.settings?.length ?? 0,
      timelines: body.rdb.timelines?.length ?? 0,
      llmInstructions: body.rdb.llmInstructions?.length ?? 0,
      chatSessions: body.rdb.chatSessions?.length ?? 0,
      chatMessages: body.rdb.chatMessages?.length ?? 0,
    },
  });
});

export default backupRouter;
