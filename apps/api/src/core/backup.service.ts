import {
  chapters,
  characters,
  chatMessages,
  chatSessions,
  contents,
  llmInstructions,
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
  novelMembers,
  novels,
  sections,
  settings,
  timelines,
} from "@novel-creator/db";
import { eq, inArray, type Table } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm/utils";
import { appLogger } from "../middleware/logger.js";
import { assertFound, type ServiceContext, ValidationError } from "./types.js";

/**
 * スキーマ定義から PgTimestamp（mode: "date"）カラム名を導出する。
 * ハードコードせずスキーマを参照するため、テーブル・カラムの追加/変更時に
 * タイムスタンプフィールドを見落とすことがない。
 */
function timestampFieldsOf(table: Table): string[] {
  return Object.entries(getTableColumns(table))
    .filter(([, column]) => column.columnType === "PgTimestamp")
    .map(([name]) => name);
}

/**
 * バックアップ JSON 上のタイムスタンプ値を Drizzle が要求する Date に変換する。
 * JSON.stringify により Date は ISO 文字列としてシリアライズされるため、
 * mode: "date" の timestamp カラムへは文字列を Date へ戻してから渡す。
 * - string: new Date(str) に変換（不正な日時文字列は ValidationError）
 * - Date: そのまま
 * - null / undefined: そのまま
 * - 上記以外（number など）: 意図しない入力のため ValidationError
 */
function normalizeTimestampValue(value: unknown, field: string): unknown {
  if (value instanceof Date) {
    return value;
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new ValidationError(
        `Invalid timestamp value for field "${field}": ${JSON.stringify(value)}`
      );
    }
    return date;
  }
  throw new ValidationError(
    `Invalid timestamp value for field "${field}": expected an ISO-8601 string, Date, or null`
  );
}

/**
 * 単一行のタイムスタンプフィールドを正規化して新しい行を返す。
 * 入力行を変更せずコピーを返す。
 */
function normalizeTimestamps<T extends object>(
  row: T,
  fields: readonly string[]
): T {
  const normalized = { ...row } as Record<string, unknown>;
  for (const field of fields) {
    if (field in normalized) {
      normalized[field] = normalizeTimestampValue(normalized[field], field);
    }
  }
  return normalized as T;
}

/**
 * 複数行のタイムスタンプフィールドを正規化する。
 */
function normalizeRows<T extends object>(
  rows: readonly T[],
  table: Table
): T[] {
  const fields = timestampFieldsOf(table);
  return rows.map((row) => normalizeTimestamps(row, fields));
}

export interface BackupBody {
  meta: {
    version: number;
    novelId: string;
    novelTitle?: string;
    exportedAt?: string;
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

export class BackupDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async exportNovel(novelId: string) {
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, novelId));
    assertFound(novel, "Novel not found");

    const chapterRows = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.novelId, novelId));
    const chapterIds = chapterRows.map((ch) => ch.id);
    const sectionRows =
      chapterIds.length > 0
        ? await this.ctx.db
            .select()
            .from(sections)
            .where(inArray(sections.chapterId, chapterIds))
        : [];
    const sectionIds = sectionRows.map((s) => s.id);
    const contentRows =
      sectionIds.length > 0
        ? await this.ctx.db
            .select()
            .from(contents)
            .where(inArray(contents.sectionId, sectionIds))
        : [];

    const [characterRows, settingRows, timelineRows, llmInstructionRows] =
      await Promise.all([
        this.ctx.db
          .select()
          .from(characters)
          .where(eq(characters.novelId, novelId)),
        this.ctx.db
          .select()
          .from(settings)
          .where(eq(settings.novelId, novelId)),
        this.ctx.db
          .select()
          .from(timelines)
          .where(eq(timelines.novelId, novelId)),
        this.ctx.db
          .select()
          .from(llmInstructions)
          .where(eq(llmInstructions.novelId, novelId)),
      ]);

    const chatSessionRows = await this.ctx.db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.novelId, novelId));
    const sessionIds = chatSessionRows.map((s) => s.id);
    const chatMessageRows =
      sessionIds.length > 0
        ? await this.ctx.db
            .select()
            .from(chatMessages)
            .where(inArray(chatMessages.sessionId, sessionIds))
        : [];

    return {
      meta: {
        exportedAt: new Date().toISOString(),
        novelId: novel.id,
        novelTitle: novel.title,
        version: 1,
      },
      rdb: {
        chapters: chapterRows,
        characters: characterRows,
        chatMessages: chatMessageRows,
        chatSessions: chatSessionRows,
        contents: contentRows,
        llmInstructions: llmInstructionRows,
        novel,
        sections: sectionRows,
        settings: settingRows,
        timelines: timelineRows,
      },
    };
  }

  async importNovel(body: BackupBody, ownerId?: string) {
    if (
      !body ||
      typeof body !== "object" ||
      !body.meta ||
      typeof body.meta.version !== "number" ||
      typeof body.meta.novelId !== "string" ||
      !body.rdb ||
      !body.rdb.novel
    ) {
      throw new ValidationError("Invalid backup structure");
    }

    const novelId = body.meta.novelId;

    await this.ctx.db.transaction(async (tx) => {
      await tx.delete(novels).where(eq(novels.id, novelId));
      await tx
        .insert(novels)
        .values(normalizeTimestamps(body.rdb.novel, timestampFieldsOf(novels)));

      if (body.rdb.chapters?.length) {
        await tx
          .insert(chapters)
          .values(normalizeRows(body.rdb.chapters, chapters));
      }
      if (body.rdb.sections?.length) {
        await tx
          .insert(sections)
          .values(normalizeRows(body.rdb.sections, sections));
      }
      if (body.rdb.contents?.length) {
        await tx
          .insert(contents)
          .values(normalizeRows(body.rdb.contents, contents));
      }
      if (body.rdb.characters?.length) {
        await tx
          .insert(characters)
          .values(normalizeRows(body.rdb.characters, characters));
      }
      if (body.rdb.settings?.length) {
        await tx
          .insert(settings)
          .values(normalizeRows(body.rdb.settings, settings));
      }
      if (body.rdb.timelines?.length) {
        await tx
          .insert(timelines)
          .values(normalizeRows(body.rdb.timelines, timelines));
      }
      if (body.rdb.llmInstructions?.length) {
        await tx
          .insert(llmInstructions)
          .values(normalizeRows(body.rdb.llmInstructions, llmInstructions));
      }
      if (body.rdb.chatSessions?.length) {
        await tx
          .insert(chatSessions)
          .values(normalizeRows(body.rdb.chatSessions, chatSessions));
      }
      if (body.rdb.chatMessages?.length) {
        await tx
          .insert(chatMessages)
          .values(normalizeRows(body.rdb.chatMessages, chatMessages));
      }
      // インポート作成者の owner 付与は同一トランザクションで行う。
      if (ownerId) {
        await tx.insert(novelMembers).values({
          novelId,
          role: "owner",
          userId: ownerId,
        });
      }
    });

    try {
      await this.ctx.vectorStore.deleteByNovel(novelId);
    } catch (err) {
      appLogger.warn("failed to clean up orphaned vectors", err);
    }

    return {
      novelId,
    };
  }
}
