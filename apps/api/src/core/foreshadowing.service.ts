import { eq } from 'drizzle-orm';
import { foreshadowings, novels, type NewForeshadowing } from '@novel-creator/db';
import {
  createForeshadowingDraft,
  editForeshadowingDocument,
  editForeshadowingSection,
  generateJSON,
  generateText,
} from '@novel-creator/llm';
import {
  diffForeshadowings,
  parseForeshadowingsMarkdown,
  serializeForeshadowingsToMarkdown,
} from '@novel-creator/shared';
import type { ForeshadowingStatus } from '@novel-creator/shared/schemas';
import { searchContext, upsertEntityEmbedding } from '../rag.js';
import { insertEditHistory } from './history.service.js';
import { assertFound, ValidationError, type ServiceContext } from './types.js';

export function foreshadowingToText(f: {
  category: string;
  title: string;
  description?: string | null;
  status: string;
}): string {
  return `[${f.category}] 伏線: ${f.title} (${f.status})\n${f.description ?? ''}`;
}

export class ForeshadowingDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async getForeshadowingsByNovel(novelId: string) {
    return this.ctx.db
      .select()
      .from(foreshadowings)
      .where(eq(foreshadowings.novelId, novelId))
      .orderBy(foreshadowings.createdAt);
  }

  async getForeshadowing(id: string) {
    const [item] = await this.ctx.db.select().from(foreshadowings).where(eq(foreshadowings.id, id));
    assertFound(item, 'Foreshadowing not found');
    return item;
  }

  async createForeshadowing(
    novelId: string,
    input: Omit<NewForeshadowing, 'id' | 'novelId' | 'createdAt' | 'updatedAt'>,
  ) {
    if (!input.title?.trim()) {
      throw new ValidationError('Title is required');
    }
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, novelId));
    assertFound(novel, 'Novel not found');

    const [created] = await this.ctx.db
      .insert(foreshadowings)
      .values({
        novelId,
        title: input.title.trim(),
        category: (input.category ?? '').trim() || '未分類',
        description: input.description ?? null,
        status: input.status ?? 'unresolved',
        placedSectionId: input.placedSectionId,
        resolvedSectionId: input.resolvedSectionId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await upsertEntityEmbedding(
      this.ctx.vectorStore,
      this.ctx.embedding,
      created.novelId,
      'foreshadowing',
      created.id,
      foreshadowingToText(created),
      this.ctx.env,
    );

    return created;
  }

  async updateForeshadowing(
    id: string,
    input: Partial<Omit<NewForeshadowing, 'id' | 'novelId' | 'createdAt' | 'updatedAt'>>,
  ) {
    const [existing] = await this.ctx.db
      .select()
      .from(foreshadowings)
      .where(eq(foreshadowings.id, id));
    assertFound(existing, 'Foreshadowing not found');

    const [updated] = await this.ctx.db
      .update(foreshadowings)
      .set({
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category.trim() || '未分類' } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.placedSectionId !== undefined ? { placedSectionId: input.placedSectionId } : {}),
        ...(input.resolvedSectionId !== undefined
          ? { resolvedSectionId: input.resolvedSectionId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(foreshadowings.id, id))
      .returning();

    try {
      await insertEditHistory(this.ctx.db, {
        novelId: existing.novelId,
        entityType: 'foreshadowing',
        entityId: id,
        title: updated.title,
        content: JSON.stringify({
          category: updated.category,
          title: updated.title,
          description: updated.description ?? '',
          status: updated.status,
          placedSectionId: updated.placedSectionId,
          resolvedSectionId: updated.resolvedSectionId,
        }),
        description: '伏線の更新',
      });
    } catch (e) {
      console.error('[history] failed to record foreshadowing history', e);
    }

    await upsertEntityEmbedding(
      this.ctx.vectorStore,
      this.ctx.embedding,
      updated.novelId,
      'foreshadowing',
      updated.id,
      foreshadowingToText(updated),
      this.ctx.env,
    );

    return updated;
  }

  async deleteForeshadowing(id: string) {
    const [existing] = await this.ctx.db
      .select()
      .from(foreshadowings)
      .where(eq(foreshadowings.id, id));
    assertFound(existing, 'Foreshadowing not found');

    const [deleted] = await this.ctx.db
      .delete(foreshadowings)
      .where(eq(foreshadowings.id, id))
      .returning();

    try {
      await this.ctx.vectorStore.deleteByEntity('foreshadowing', id);
    } catch (err) {
      console.error('[vector] failed to delete foreshadowing embedding', err);
    }

    return deleted;
  }

  async generateDraft(
    query: string,
    currentDraft?: { category?: string; title: string; description?: string; status?: string },
  ) {
    const prompt = createForeshadowingDraft(query, currentDraft);
    return generateJSON<{
      category: string;
      title: string;
      description: string;
      status: ForeshadowingStatus;
    }>(this.ctx.llm, prompt);
  }

  async getMarkdown(novelId: string) {
    const rows = await this.ctx.db
      .select()
      .from(foreshadowings)
      .where(eq(foreshadowings.novelId, novelId));
    return serializeForeshadowingsToMarkdown(rows);
  }

  async saveMarkdown(novelId: string, markdown: string) {
    const existing = await this.ctx.db
      .select()
      .from(foreshadowings)
      .where(eq(foreshadowings.novelId, novelId));
    const parsed = parseForeshadowingsMarkdown(markdown);
    const diff = diffForeshadowings(existing, parsed);

    const createdIds: string[] = [];
    await this.ctx.db.transaction(async (tx) => {
      for (const item of diff.toCreate) {
        const [row] = await tx
          .insert(foreshadowings)
          .values({
            novelId,
            title: item.title,
            category: item.category,
            description: item.description,
            status: item.status,
            placedSectionId: item.placedSectionId,
            resolvedSectionId: item.resolvedSectionId,
          })
          .returning();
        createdIds.push(row.id);
      }

      for (const u of diff.toUpdate) {
        await tx
          .update(foreshadowings)
          .set({
            title: u.title,
            category: u.category,
            description: u.description,
            status: u.status,
            placedSectionId: u.placedSectionId,
            resolvedSectionId: u.resolvedSectionId,
            updatedAt: new Date(),
          })
          .where(eq(foreshadowings.id, u.id));
      }

      for (const id of diff.toDelete) {
        await tx.delete(foreshadowings).where(eq(foreshadowings.id, id));
      }
    });

    for (let i = 0; i < diff.toCreate.length; i++) {
      const f = diff.toCreate[i];
      await upsertEntityEmbedding(
        this.ctx.vectorStore,
        this.ctx.embedding,
        novelId,
        'foreshadowing',
        createdIds[i],
        foreshadowingToText(f),
        this.ctx.env,
      );
    }

    for (const u of diff.toUpdate) {
      await upsertEntityEmbedding(
        this.ctx.vectorStore,
        this.ctx.embedding,
        novelId,
        'foreshadowing',
        u.id,
        foreshadowingToText(u),
        this.ctx.env,
      );
    }

    for (const id of diff.toDelete) {
      try {
        await this.ctx.vectorStore.deleteByEntity('foreshadowing', id);
      } catch (err) {
        console.error('[vector] failed to delete foreshadowing embedding', err);
      }
    }

    const previousMarkdown = serializeForeshadowingsToMarkdown(existing);
    if (previousMarkdown !== markdown) {
      try {
        await insertEditHistory(this.ctx.db, {
          novelId,
          entityType: 'foreshadowings_document',
          entityId: novelId,
          title: '伏線マークダウン一括編集',
          content: markdown,
          description: '手動マークダウン編集',
        });
      } catch (e) {
        console.error('[history] failed to record foreshadowing doc history', e);
      }
    }

    return {
      created: diff.toCreate.length,
      updated: diff.toUpdate.length,
      deleted: diff.toDelete.length,
    };
  }

  async editForeshadowingDocument(novelId: string, instruction: string) {
    const currentMarkdown = await this.getMarkdown(novelId);
    const ragCtx = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      novelId,
      { query: instruction },
      this.ctx.env,
    );
    const prompt = editForeshadowingDocument(currentMarkdown, instruction, {
      settings: ragCtx.settings,
      characters: ragCtx.characters,
    });
    const generated = await generateText(this.ctx.llm, prompt);

    try {
      await insertEditHistory(this.ctx.db, {
        novelId,
        entityType: 'foreshadowings_document',
        entityId: novelId,
        title: '伏線マークダウンAI編集',
        content: generated,
        description: `AIによる編集: ${instruction}`,
      });
    } catch (e) {
      console.error('[history] failed to record foreshadowing doc AI history', e);
    }

    return { markdown: generated };
  }

  async editForeshadowingSection(
    novelId: string,
    section: { category: string; title: string; description: string; status?: string },
    instruction: string,
  ) {
    const ragCtx = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      novelId,
      { query: `${section.description} ${instruction}` },
      this.ctx.env,
    );
    const prompt = editForeshadowingSection(section, instruction, {
      settings: ragCtx.settings,
      characters: ragCtx.characters,
    });
    const generated = await generateText(this.ctx.llm, prompt);

    return { body: generated };
  }
}
