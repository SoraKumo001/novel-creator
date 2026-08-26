import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { eq, inArray } from 'drizzle-orm';
import {
  chapters,
  characters,
  chatMessages,
  chatSessions,
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
import { BackupService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';

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

export function registerBackupService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(BackupService, {
    async exportNovel(req) {
      const db = getContext().db;
      const novelId = req.novelId;

      const [novel] = await db.select().from(novels).where(eq(novels.id, novelId));
      if (!novel) {
        throw new ConnectError('Novel not found', Code.NotFound);
      }

      const chapterRows = await db.select().from(chapters).where(eq(chapters.novelId, novelId));
      const chapterIds = chapterRows.map((ch) => ch.id);
      const sectionRows =
        chapterIds.length > 0
          ? await db.select().from(sections).where(inArray(sections.chapterId, chapterIds))
          : [];
      const sectionIds = sectionRows.map((s) => s.id);
      const contentRows =
        sectionIds.length > 0
          ? await db.select().from(contents).where(inArray(contents.sectionId, sectionIds))
          : [];

      const [characterRows, settingRows, timelineRows, llmInstructionRows] = await Promise.all([
        db.select().from(characters).where(eq(characters.novelId, novelId)),
        db.select().from(settings).where(eq(settings.novelId, novelId)),
        db.select().from(timelines).where(eq(timelines.novelId, novelId)),
        db.select().from(llmInstructions).where(eq(llmInstructions.novelId, novelId)),
      ]);

      const chatSessionRows = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.novelId, novelId));
      const sessionIds = chatSessionRows.map((s) => s.id);
      const chatMessageRows =
        sessionIds.length > 0
          ? await db.select().from(chatMessages).where(inArray(chatMessages.sessionId, sessionIds))
          : [];

      const exportData = {
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
      };

      return {
        jsonData: JSON.stringify(exportData),
      };
    },

    async importNovel(req) {
      const ctx = getContext();
      const db = ctx.db;
      let body: BackupBody;
      try {
        body = JSON.parse(req.jsonData) as BackupBody;
      } catch {
        throw new ConnectError('Invalid JSON data', Code.InvalidArgument);
      }

      if (
        !body ||
        typeof body !== 'object' ||
        !body.meta ||
        typeof body.meta.version !== 'number' ||
        typeof body.meta.novelId !== 'string' ||
        !body.rdb ||
        !body.rdb.novel
      ) {
        throw new ConnectError('Invalid backup structure', Code.InvalidArgument);
      }

      const novelId = body.meta.novelId;

      await db.transaction(async (tx) => {
        await tx.delete(novels).where(eq(novels.id, novelId));
        await tx.insert(novels).values(body.rdb.novel);

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

      try {
        await ctx.vectorStore.deleteByNovel(novelId);
      } catch (err) {
        console.error('[backup] failed to clean up orphaned vectors', err);
      }

      return {
        success: true,
        novelId,
      };
    },
  });
}
