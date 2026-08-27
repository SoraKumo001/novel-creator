import { and, desc, eq } from 'drizzle-orm';
import {
  characters,
  contents,
  editHistories,
  sections,
  settings,
  type NewEditHistory,
} from '@novel-creator/db';
import { parseCharactersMarkdown, parseSettingsMarkdown } from '@novel-creator/shared';
import { upsertEntityEmbedding } from '../rag.js';
import { NotFoundError, type ServiceContext } from './types.js';

export interface RecordHistoryInput {
  novelId: string;
  entityType: string;
  entityId: string;
  title: string;
  content: string;
  description: string;
  wordCount?: number;
}

export class HistoryDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async recordHistory(input: RecordHistoryInput) {
    const newEntry: NewEditHistory = {
      novelId: input.novelId,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      content: input.content,
      description: input.description,
      wordCount: input.wordCount,
    };

    const [created] = await this.ctx.db.insert(editHistories).values(newEntry).returning();

    return created;
  }

  async listHistories(
    novelId: string,
    options?: {
      entityType?: string;
      entityId?: string;
      limit?: number;
    },
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

    if (!history) {
      throw new NotFoundError('History', id);
    }

    return history;
  }

  async restoreHistory(id: string) {
    const history = await this.getHistory(id);

    if (history.entityType === 'content') {
      const sectionId = history.entityId;
      const [section] = await this.ctx.db.select().from(sections).where(eq(sections.id, sectionId));
      if (!section) {
        throw new NotFoundError('Section', sectionId);
      }

      const wordCount = history.wordCount ?? history.content.length;
      await this.ctx.db
        .insert(contents)
        .values({
          sectionId,
          body: history.content,
          wordCount,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: contents.sectionId,
          set: {
            body: history.content,
            wordCount,
            updatedAt: new Date(),
          },
        });

      // 復元したこと自体の履歴も記録
      await this.recordHistory({
        novelId: history.novelId,
        entityType: 'content',
        entityId: sectionId,
        title: history.title,
        content: history.content,
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString('ja-JP')})から復元`,
        wordCount,
      });

      // RAG 同期
      await upsertEntityEmbedding(
        this.ctx.vectorStore,
        this.ctx.embedding,
        history.novelId,
        'content',
        sectionId,
        history.content,
        this.ctx.env,
      );

      return { success: true, message: '本文を復元しました' };
    }

    if (history.entityType === 'setting') {
      const settingId = history.entityId;
      let parsed: { category: string; name: string; description: string };
      try {
        parsed = JSON.parse(history.content);
      } catch {
        parsed = { category: '未分類', name: history.title, description: history.content };
      }

      await this.ctx.db
        .update(settings)
        .set({
          category: parsed.category,
          name: parsed.name,
          description: parsed.description,
          updatedAt: new Date(),
        })
        .where(eq(settings.id, settingId));

      await this.recordHistory({
        novelId: history.novelId,
        entityType: 'setting',
        entityId: settingId,
        title: parsed.name,
        content: history.content,
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString('ja-JP')})から復元`,
      });

      return { success: true, message: '設定を復元しました' };
    }

    if (history.entityType === 'character') {
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
          category: '未分類',
          name: history.title,
          description: history.content,
        };
      }

      await this.ctx.db
        .update(characters)
        .set({
          category: parsed.category,
          name: parsed.name,
          description: parsed.description,
          traits: parsed.traits,
          relationships: parsed.relationships,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, characterId));

      await this.recordHistory({
        novelId: history.novelId,
        entityType: 'character',
        entityId: characterId,
        title: parsed.name,
        content: history.content,
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString('ja-JP')})から復元`,
      });

      return { success: true, message: '人物を復元しました' };
    }

    if (history.entityType === 'characters_markdown') {
      const parsedCharacters = parseCharactersMarkdown(history.content);
      await this.ctx.db.delete(characters).where(eq(characters.novelId, history.novelId));
      if (parsedCharacters.length > 0) {
        await this.ctx.db.insert(characters).values(
          parsedCharacters.map((c) => ({
            novelId: history.novelId,
            category: c.category,
            name: c.name,
            description: c.description,
            traits: c.traits,
            relationships: c.relationships,
          })),
        );
      }

      await this.recordHistory({
        novelId: history.novelId,
        entityType: 'characters_markdown',
        entityId: history.novelId,
        title: '人物マークダウン',
        content: history.content,
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString('ja-JP')})から復元`,
        wordCount: history.content.length,
      });

      return { success: true, message: '人物マークダウンを復元しました' };
    }

    if (history.entityType === 'settings_markdown') {
      const parsedSettings = parseSettingsMarkdown(history.content);
      await this.ctx.db.delete(settings).where(eq(settings.novelId, history.novelId));
      if (parsedSettings.length > 0) {
        await this.ctx.db.insert(settings).values(
          parsedSettings.map((s) => ({
            novelId: history.novelId,
            category: s.category,
            name: s.name,
            description: s.description,
          })),
        );
      }

      await this.recordHistory({
        novelId: history.novelId,
        entityType: 'settings_markdown',
        entityId: history.novelId,
        title: '設定マークダウン',
        content: history.content,
        description: `過去のバージョン(${new Date(history.createdAt).toLocaleString('ja-JP')})から復元`,
        wordCount: history.content.length,
      });

      return { success: true, message: '設定マークダウンを復元しました' };
    }

    return { success: false, message: '未対応のエンティティタイプです' };
  }
}
