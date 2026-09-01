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
import { and, desc, eq } from "drizzle-orm";
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

/** insert に必要な最小限の構造を持つ db またはトランザクション */
type EditHistoryDb = Pick<Database, "insert">;

export async function insertEditHistory(
  db: EditHistoryDb,
  input: RecordHistoryInput
) {
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

export class HistoryDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async recordHistory(input: RecordHistoryInput) {
    return insertEditHistory(this.ctx.db, input);
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

    const limit = options?.limit ?? 50;

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
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString("ja-JP")})から復元`,
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
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString("ja-JP")})から復元`,
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
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString("ja-JP")})から復元`,
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
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString("ja-JP")})から復元`,
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
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString("ja-JP")})から復元`,
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
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString("ja-JP")})から復元`,
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
