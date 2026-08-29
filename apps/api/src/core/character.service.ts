import { eq } from 'drizzle-orm';
import { characters } from '@novel-creator/db';
import {
  editCharacter,
  editCharacterDocument,
  editCharacterSection,
  generateJSON,
  generateText,
} from '@novel-creator/llm';
import {
  diffCharacters,
  parseCharactersMarkdown,
  serializeCharactersToMarkdown,
} from '@novel-creator/shared';
import { searchContext, upsertEntityEmbedding } from '../rag.js';
import { insertEditHistory } from './history.service.js';
import { assertFound, ValidationError, type ServiceContext } from './types.js';

export function characterToText(ch: {
  category?: string;
  name: string;
  description?: string | null;
  traits?: string[] | null;
}): string {
  return `[${ch.category ?? '未分類'}] ${ch.name}\n${ch.description ?? ''}\n特徴: ${ch.traits?.join('、') ?? ''}`;
}

export class CharacterDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listCharacters(novelId: string) {
    return this.ctx.db.select().from(characters).where(eq(characters.novelId, novelId));
  }

  async getCharacter(id: string) {
    const [character] = await this.ctx.db.select().from(characters).where(eq(characters.id, id));
    assertFound(character, 'Character not found');
    return character;
  }

  async createCharacter(data: {
    novelId: string;
    category?: string;
    name: string;
    description?: string | null;
    traits?: string[];
    relationships?: Record<string, unknown>;
  }) {
    if (!data.name?.trim()) {
      throw new ValidationError('Name is required');
    }

    const [row] = await this.ctx.db
      .insert(characters)
      .values({
        novelId: data.novelId,
        category: data.category ?? '主要人物',
        name: data.name,
        description: data.description ?? null,
        traits: data.traits ?? [],
        relationships: data.relationships ?? {},
      })
      .returning();

    await upsertEntityEmbedding(
      this.ctx.vectorStore,
      this.ctx.embedding,
      row.novelId,
      'character',
      row.id,
      characterToText(row),
      this.ctx.env,
    );

    return row;
  }

  async updateCharacter(
    id: string,
    data: {
      category?: string;
      name?: string;
      description?: string | null;
      traits?: string[];
      relationships?: Record<string, unknown>;
    },
  ) {
    const [row] = await this.ctx.db
      .update(characters)
      .set({
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.traits !== undefined ? { traits: data.traits } : {}),
        ...(data.relationships !== undefined ? { relationships: data.relationships } : {}),
        updatedAt: new Date(),
      })
      .where(eq(characters.id, id))
      .returning();
    assertFound(row, 'Character not found');

    try {
      await insertEditHistory(this.ctx.db, {
        novelId: row.novelId,
        entityType: 'character',
        entityId: row.id,
        title: row.name,
        content: JSON.stringify({
          category: row.category,
          name: row.name,
          description: row.description ?? '',
          traits: row.traits,
          relationships: row.relationships,
        }),
        description: '人物情報の更新',
      });
    } catch (e) {
      console.error('[history] failed to record character history', e);
    }

    await upsertEntityEmbedding(
      this.ctx.vectorStore,
      this.ctx.embedding,
      row.novelId,
      'character',
      row.id,
      characterToText(row),
      this.ctx.env,
    );

    return row;
  }

  async deleteCharacter(id: string) {
    const [row] = await this.ctx.db.delete(characters).where(eq(characters.id, id)).returning();
    assertFound(row, 'Character not found');
    try {
      await this.ctx.vectorStore.deleteByEntity('character', id);
    } catch (err) {
      console.error('[vector] failed to delete character embedding', err);
    }
    return row;
  }

  async editCharacterWithInstruction(id: string, instruction: string) {
    const character = await this.getCharacter(id);

    const prompt = editCharacter(
      {
        category: character.category ?? undefined,
        name: character.name,
        description: character.description ?? undefined,
        traits: (character.traits as string[]) ?? undefined,
      },
      instruction,
    );

    const result = await generateJSON<{
      category: string;
      name: string;
      description: string;
      traits: string[];
    }>(this.ctx.llm, prompt);

    const [row] = await this.ctx.db
      .update(characters)
      .set({
        category: result.category,
        name: result.name,
        description: result.description,
        traits: result.traits,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, id))
      .returning();

    await upsertEntityEmbedding(
      this.ctx.vectorStore,
      this.ctx.embedding,
      row.novelId,
      'character',
      row.id,
      characterToText(row),
      this.ctx.env,
    );

    return row;
  }

  async getMarkdown(novelId: string) {
    const rows = await this.ctx.db.select().from(characters).where(eq(characters.novelId, novelId));
    return serializeCharactersToMarkdown(rows);
  }

  async saveMarkdown(novelId: string, markdown: string) {
    const existing = await this.ctx.db
      .select()
      .from(characters)
      .where(eq(characters.novelId, novelId));
    const parsed = parseCharactersMarkdown(markdown);
    const diff = diffCharacters(existing, parsed);

    const createdIds: string[] = [];
    await this.ctx.db.transaction(async (tx) => {
      for (const ch of diff.toCreate) {
        const [row] = await tx
          .insert(characters)
          .values({
            novelId,
            name: ch.name,
            category: ch.category,
            description: ch.description,
            traits: ch.traits,
            relationships: ch.relationships,
          })
          .returning();
        createdIds.push(row.id);
      }

      for (const u of diff.toUpdate) {
        await tx
          .update(characters)
          .set({
            category: u.category,
            description: u.description,
            traits: u.traits,
            relationships: u.relationships,
            updatedAt: new Date(),
          })
          .where(eq(characters.id, u.id));
      }

      for (const id of diff.toDelete) {
        await tx.delete(characters).where(eq(characters.id, id));
      }
    });

    for (let i = 0; i < diff.toCreate.length; i++) {
      const ch = diff.toCreate[i];
      await upsertEntityEmbedding(
        this.ctx.vectorStore,
        this.ctx.embedding,
        novelId,
        'character',
        createdIds[i],
        characterToText(ch),
        this.ctx.env,
      );
    }
    for (const u of diff.toUpdate) {
      await upsertEntityEmbedding(
        this.ctx.vectorStore,
        this.ctx.embedding,
        novelId,
        'character',
        u.id,
        characterToText(u),
        this.ctx.env,
      );
    }
    for (const id of diff.toDelete) {
      await this.ctx.vectorStore.deleteByEntity('character', id);
    }

    const updated = await this.ctx.db
      .select()
      .from(characters)
      .where(eq(characters.novelId, novelId));

    try {
      await insertEditHistory(this.ctx.db, {
        novelId,
        entityType: 'characters_markdown',
        entityId: novelId,
        title: '人物マークダウン',
        content: markdown,
        description: `マークダウン一括保存 (作成: ${diff.toCreate.length}, 更新: ${diff.toUpdate.length}, 削除: ${diff.toDelete.length})`,
        wordCount: markdown.length,
      });
    } catch (e) {
      console.error('[history] failed to record characters_markdown history', e);
    }

    return {
      characters: updated,
      createdCount: diff.toCreate.length,
      updatedCount: diff.toUpdate.length,
      deletedCount: diff.toDelete.length,
    };
  }

  async editCharacterSection(data: {
    novelId: string;
    category: string;
    name: string;
    description: string;
    traits: string[];
    relationships: string;
    instruction: string;
  }) {
    const ragCtx = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      data.novelId,
      { query: `${data.description} ${data.instruction}` },
      this.ctx.env,
    );

    const prompt = editCharacterSection(
      {
        category: data.category,
        name: data.name,
        description: data.description,
        traits: data.traits,
        relationships: data.relationships,
      },
      data.instruction,
      { settings: ragCtx.settings, characters: ragCtx.characters },
    );

    return generateText(this.ctx.llm, prompt);
  }

  async editCharacterDocument(novelId: string, markdown: string, instruction: string) {
    const ragCtx = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      novelId,
      { query: instruction },
      this.ctx.env,
    );

    const prompt = editCharacterDocument(markdown, instruction, {
      settings: ragCtx.settings,
      characters: ragCtx.characters,
    });

    return generateText(this.ctx.llm, prompt);
  }
}
