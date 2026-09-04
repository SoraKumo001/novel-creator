import {
  characters,
  contents,
  type Database,
  editHistories,
  type NewEditHistory,
  novels,
  sections,
  settings,
} from "@novel-creator/db";
import {
  parseCharactersMarkdown,
  parseSettingsMarkdown,
} from "@novel-creator/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { appLogger } from "../middleware/logger.js";
import { upsertEntityEmbedding } from "../rag.js";
import { assertFound, type ServiceContext } from "./types.js";

export interface RecordHistoryInput {
  content: string;
  description: string;
  entityId: string;
  entityType: string;
  novelId: string;
  title: string;
  wordCount?: number;
}

/** entity あたりに保持する履歴の上限件数 */
export const HISTORY_RETENTION_LIMIT = 100;

/** 履歴本文の比較用ハッシュ（簡易ハッシュ、全文比較の前段用） */
export function hashHistoryContent(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 33 + content.charCodeAt(i)) % 4_294_967_296;
  }
  return hash.toString(16);
}

/** 復元記録用の description を組み立てる */
export function buildRestoreDescription(sourceCreatedAt: Date): string {
  return `過去のバージョン(${new Date(sourceCreatedAt).toLocaleString("ja-JP")})から復元`;
}

/** insert に必要な最小限の構造を持つ db またはトランザクション */
type EditHistoryDb = Pick<Database, "insert">;

/** select 可能（フル DB）な場合のみ Database として扱う */
function asFullDatabase(db: EditHistoryDb): Database | undefined {
  const candidate = db as Partial<Database>;
  if (typeof candidate.select !== "function") {
    return undefined;
  }
  return db as Database;
}

export async function insertEditHistory(
  db: EditHistoryDb,
  input: RecordHistoryInput
) {
  // 同一内容の連続保存は履歴を増やさない（直近1件のハッシュ比較）
  const fullDb = asFullDatabase(db);
  if (fullDb) {
    try {
      const [latest] = await fullDb
        .select()
        .from(editHistories)
        .where(
          and(
            eq(editHistories.novelId, input.novelId),
            eq(editHistories.entityType, input.entityType),
            eq(editHistories.entityId, input.entityId)
          )
        )
        .orderBy(desc(editHistories.createdAt))
        .limit(1);
      if (
        latest &&
        hashHistoryContent(latest.content) === hashHistoryContent(input.content)
      ) {
        return latest;
      }
    } catch (error) {
      appLogger.warn("failed to check duplicate history, recording anyway", {
        entityId: input.entityId,
        entityType: input.entityType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const newEntry: NewEditHistory = {
    content: input.content,
    description: input.description,
    entityId: input.entityId,
    entityType: input.entityType,
    novelId: input.novelId,
    title: input.title,
    wordCount: input.wordCount,
  };
  const [created] = await db.insert(editHistories).values(newEntry).returning();
  return created;
}

export interface PurgeHistoriesInput {
  entityId: string;
  entityType: string;
  keep?: number;
  novelId: string;
}

/** 上限を超えた古い履歴を削除する。削除件数を返す。 */
export async function purgeOldHistories(
  db: Database,
  input: PurgeHistoriesInput
): Promise<number> {
  const keep = input.keep ?? HISTORY_RETENTION_LIMIT;
  const rows = await db
    .select({ id: editHistories.id })
    .from(editHistories)
    .where(
      and(
        eq(editHistories.novelId, input.novelId),
        eq(editHistories.entityType, input.entityType),
        eq(editHistories.entityId, input.entityId)
      )
    )
    .orderBy(desc(editHistories.createdAt));
  if (rows.length <= keep) {
    return 0;
  }
  const staleIds = rows.slice(keep).map((row) => row.id);
  await db.delete(editHistories).where(inArray(editHistories.id, staleIds));
  return staleIds.length;
}

export class HistoryDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async recordHistory(input: RecordHistoryInput) {
    const created = await insertEditHistory(this.ctx.db, input);
    // 上限超過分を整理する（fire-and-forget にせず await する）
    try {
      await purgeOldHistories(this.ctx.db, {
        entityId: input.entityId,
        entityType: input.entityType,
        novelId: input.novelId,
      });
    } catch (error) {
      appLogger.warn("failed to purge old histories", {
        entityId: input.entityId,
        entityType: input.entityType,
        error: error instanceof Error ? error.message : String(error),
        novelId: input.novelId,
      });
    }
    return created;
  }

  async listHistories(
    novelId: string,
    options?: {
      entityType?: string;
      entityId?: string;
      limit?: number;
    }
  ) {
    const conditions = [eq(editHistories.novelId, novelId)];

    if (options?.entityType) {
      conditions.push(eq(editHistories.entityType, options.entityType));
    }
    if (options?.entityId) {
      conditions.push(eq(editHistories.entityId, options.entityId));
    }

    const limit = Math.min(options?.limit ?? 50, HISTORY_RETENTION_LIMIT);

    return this.ctx.db
      .select()
      .from(editHistories)
      .where(and(...conditions))
      .orderBy(desc(editHistories.createdAt))
      .limit(limit);
  }

  async getHistory(id: string) {
    const [history] = await this.ctx.db
      .select()
      .from(editHistories)
      .where(eq(editHistories.id, id));

    assertFound(history, "History", id);

    return history;
  }

  async restoreHistory(id: string) {
    const history = await this.getHistory(id);

    if (history.entityType === "content") {
      const sectionId = history.entityId;
      const [section] = await this.ctx.db
        .select()
        .from(sections)
        .where(eq(sections.id, sectionId));
      assertFound(section, "Section", sectionId);

      const wordCount = history.wordCount ?? history.content.length;
      await this.ctx.db
        .insert(contents)
        .values({
          body: history.content,
          sectionId,
          updatedAt: new Date(),
          wordCount,
        })
        .onConflictDoUpdate({
          set: {
            body: history.content,
            updatedAt: new Date(),
            wordCount,
          },
          target: contents.sectionId,
        });

      // 復元したこと自体の履歴も記録
      await this.recordHistory({
        content: history.content,
        description: buildRestoreDescription(history.createdAt),
        entityId: sectionId,
        entityType: "content",
        novelId: history.novelId,
        title: history.title,
        wordCount,
      });

      // RAG 同期
      await upsertEntityEmbedding(
        this.ctx.vectorStore,
        this.ctx.embedding,
        history.novelId,
        "content",
        sectionId,
        history.content,
        this.ctx.env
      );

      return { message: "本文を復元しました", success: true };
    }

    if (history.entityType === "setting") {
      const settingId = history.entityId;
      let parsed: { category: string; name: string; description: string };
      try {
        parsed = JSON.parse(history.content);
      } catch {
        parsed = {
          category: "未分類",
          description: history.content,
          name: history.title,
        };
      }

      await this.ctx.db
        .update(settings)
        .set({
          category: parsed.category,
          description: parsed.description,
          name: parsed.name,
          updatedAt: new Date(),
        })
        .where(eq(settings.id, settingId));

      await this.recordHistory({
        content: history.content,
        description: buildRestoreDescription(history.createdAt),
        entityId: settingId,
        entityType: "setting",
        novelId: history.novelId,
        title: parsed.name,
      });

      return { message: "設定を復元しました", success: true };
    }

    if (history.entityType === "character") {
      const characterId = history.entityId;
      let parsed: {
        category: string;
        name: string;
        description: string;
        traits?: string[];
        relationships?: unknown;
      };
      try {
        parsed = JSON.parse(history.content);
      } catch {
        parsed = {
          category: "未分類",
          description: history.content,
          name: history.title,
        };
      }

      await this.ctx.db
        .update(characters)
        .set({
          category: parsed.category,
          description: parsed.description,
          name: parsed.name,
          relationships: parsed.relationships,
          traits: parsed.traits,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, characterId));

      await this.recordHistory({
        content: history.content,
        description: buildRestoreDescription(history.createdAt),
        entityId: characterId,
        entityType: "character",
        novelId: history.novelId,
        title: parsed.name,
      });

      return { message: "人物を復元しました", success: true };
    }

    if (history.entityType === "characters_markdown") {
      const parsedCharacters = parseCharactersMarkdown(history.content);
      await this.ctx.db
        .delete(characters)
        .where(eq(characters.novelId, history.novelId));
      if (parsedCharacters.length > 0) {
        await this.ctx.db.insert(characters).values(
          parsedCharacters.map((c) => ({
            category: c.category,
            description: c.description,
            name: c.name,
            novelId: history.novelId,
            relationships: c.relationships,
            traits: c.traits,
          }))
        );
      }

      await this.recordHistory({
        content: history.content,
        description: buildRestoreDescription(history.createdAt),
        entityId: history.novelId,
        entityType: "characters_markdown",
        novelId: history.novelId,
        title: "人物マークダウン",
        wordCount: history.content.length,
      });

      return { message: "人物マークダウンを復元しました", success: true };
    }

    if (history.entityType === "settings_markdown") {
      const parsedSettings = parseSettingsMarkdown(history.content);
      await this.ctx.db
        .delete(settings)
        .where(eq(settings.novelId, history.novelId));
      if (parsedSettings.length > 0) {
        await this.ctx.db.insert(settings).values(
          parsedSettings.map((s) => ({
            category: s.category,
            description: s.description,
            name: s.name,
            novelId: history.novelId,
          }))
        );
      }

      await this.recordHistory({
        content: history.content,
        description: buildRestoreDescription(history.createdAt),
        entityId: history.novelId,
        entityType: "settings_markdown",
        novelId: history.novelId,
        title: "設定マークダウン",
        wordCount: history.content.length,
      });

      return { message: "設定マークダウンを復元しました", success: true };
    }

    if (history.entityType === "story_outline_markdown") {
      await this.ctx.db
        .update(novels)
        .set({
          storyOutline: history.content,
          updatedAt: new Date(),
        })
        .where(eq(novels.id, history.novelId));

      await this.recordHistory({
        content: history.content,
        description: buildRestoreDescription(history.createdAt),
        entityId: history.novelId,
        entityType: "story_outline_markdown",
        novelId: history.novelId,
        title: "ストーリー構想マークダウン",
        wordCount: history.content.length,
      });

      return {
        message: "ストーリー構想マークダウンを復元しました",
        success: true,
      };
    }

    return { message: "未対応のエンティティタイプです", success: false };
  }
}
