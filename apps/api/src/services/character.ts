import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { eq } from 'drizzle-orm';
import { characters } from '@novel-creator/db';
import {
  editCharacter,
  editCharacterDocument,
  editCharacterSection,
  generateJSON,
  generateText,
} from '@novel-creator/llm';
import { CharacterService } from '@novel-creator/proto';
import {
  diffCharacters,
  parseCharactersMarkdown,
  serializeCharactersToMarkdown,
} from '@novel-creator/shared';

import type { AppContext } from '../context.js';
import { searchContext, upsertEntityEmbedding } from '../rag.js';

function formatCharacter(row: typeof characters.$inferSelect) {
  return {
    id: row.id,
    novelId: row.novelId,
    category: row.category,
    name: row.name,
    description: row.description ?? undefined,
    traits: (row.traits as string[]) ?? [],
    relationshipsJson: JSON.stringify(row.relationships ?? {}),
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

function characterToText(ch: {
  category?: string;
  name: string;
  description?: string | null;
  traits?: string[] | null;
}): string {
  return `[${ch.category ?? '未分類'}] ${ch.name}\n${ch.description ?? ''}\n特徴: ${ch.traits?.join('、') ?? ''}`;
}

export function registerCharacterService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(CharacterService, {
    async listCharacters(req) {
      const db = getContext().db;
      const rows = await db.select().from(characters).where(eq(characters.novelId, req.novelId));
      return {
        characters: rows.map(formatCharacter),
      };
    },

    async getCharacter(req) {
      const db = getContext().db;
      const [character] = await db.select().from(characters).where(eq(characters.id, req.id));
      if (!character) {
        throw new ConnectError('Character not found', Code.NotFound);
      }
      return formatCharacter(character);
    },

    async createCharacter(req) {
      const ctx = getContext();
      const db = ctx.db;
      if (!req.name.trim()) {
        throw new ConnectError('Name is required', Code.InvalidArgument);
      }
      let rel = {};
      try {
        if (req.relationshipsJson) {
          rel = JSON.parse(req.relationshipsJson);
        }
      } catch {
        rel = {};
      }
      const [row] = await db
        .insert(characters)
        .values({
          novelId: req.novelId,
          category: req.category,
          name: req.name,
          description: req.description ?? null,
          traits: req.traits ?? [],
          relationships: rel,
        })
        .returning();

      await upsertEntityEmbedding(
        ctx.vectorStore,
        ctx.embedding,
        row.novelId,
        'character',
        row.id,
        characterToText(row),
        ctx.env,
      );

      return formatCharacter(row);
    },

    async updateCharacter(req) {
      const ctx = getContext();
      const db = ctx.db;
      let relUpdate: Record<string, unknown> | undefined;
      if (req.relationshipsJson !== undefined) {
        try {
          relUpdate = JSON.parse(req.relationshipsJson);
        } catch {
          relUpdate = {};
        }
      }

      const [row] = await db
        .update(characters)
        .set({
          ...(req.category !== undefined ? { category: req.category } : {}),
          ...(req.name !== undefined ? { name: req.name } : {}),
          ...(req.description !== undefined ? { description: req.description } : {}),
          ...(req.traits !== undefined ? { traits: req.traits } : {}),
          ...(relUpdate !== undefined ? { relationships: relUpdate } : {}),
          updatedAt: new Date(),
        })
        .where(eq(characters.id, req.id))
        .returning();
      if (!row) {
        throw new ConnectError('Character not found', Code.NotFound);
      }

      await upsertEntityEmbedding(
        ctx.vectorStore,
        ctx.embedding,
        row.novelId,
        'character',
        row.id,
        characterToText(row),
        ctx.env,
      );

      return formatCharacter(row);
    },

    async deleteCharacter(req) {
      const ctx = getContext();
      const db = ctx.db;
      const [row] = await db.delete(characters).where(eq(characters.id, req.id)).returning();
      if (!row) {
        throw new ConnectError('Character not found', Code.NotFound);
      }
      try {
        await ctx.vectorStore.deleteByEntity('character', req.id);
      } catch (err) {
        console.error('[vector] failed to delete character embedding', err);
      }
      return { success: true };
    },

    async editCharacter(req) {
      const ctx = getContext();
      const db = ctx.db;
      const [character] = await db.select().from(characters).where(eq(characters.id, req.id));
      if (!character) {
        throw new ConnectError('Character not found', Code.NotFound);
      }

      const prompt = editCharacter(
        {
          category: character.category ?? undefined,
          name: character.name,
          description: character.description ?? undefined,
          traits: character.traits ?? undefined,
        },
        req.instruction,
      );

      const result = await generateJSON<{
        category: string;
        name: string;
        description: string;
        traits: string[];
      }>(ctx.llm, prompt);

      const [row] = await db
        .update(characters)
        .set({
          category: result.category,
          name: result.name,
          description: result.description,
          traits: result.traits,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, req.id))
        .returning();

      await upsertEntityEmbedding(
        ctx.vectorStore,
        ctx.embedding,
        row.novelId,
        'character',
        row.id,
        characterToText(row),
        ctx.env,
      );

      return formatCharacter(row);
    },

    async getCharactersMarkdown(req) {
      const db = getContext().db;
      const rows = await db.select().from(characters).where(eq(characters.novelId, req.novelId));
      const markdown = serializeCharactersToMarkdown(rows);
      return { markdown };
    },

    async saveCharactersMarkdown(req) {
      const ctx = getContext();
      const db = ctx.db;
      const novelId = req.novelId;
      const existing = await db.select().from(characters).where(eq(characters.novelId, novelId));
      const parsed = parseCharactersMarkdown(req.markdown);
      const diff = diffCharacters(existing, parsed);

      const createdIds: string[] = [];
      await db.transaction(async (tx) => {
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
          ctx.vectorStore,
          ctx.embedding,
          novelId,
          'character',
          createdIds[i],
          characterToText(ch),
          ctx.env,
        );
      }
      for (const u of diff.toUpdate) {
        await upsertEntityEmbedding(
          ctx.vectorStore,
          ctx.embedding,
          novelId,
          'character',
          u.id,
          characterToText(u),
          ctx.env,
        );
      }
      for (const id of diff.toDelete) {
        await ctx.vectorStore.deleteByEntity('character', id);
      }

      const updated = await db.select().from(characters).where(eq(characters.novelId, novelId));

      return {
        characters: updated.map(formatCharacter),
        createdCount: diff.toCreate.length,
        updatedCount: diff.toUpdate.length,
        deletedCount: diff.toDelete.length,
      };
    },

    async editCharacterSection(req) {
      const ctx = getContext();
      const novelId = req.novelId;

      const ragCtx = await searchContext(
        ctx.vectorStore,
        ctx.embedding,
        novelId,
        { query: `${req.description} ${req.instruction}` },
        ctx.env,
      );

      const prompt = editCharacterSection(
        {
          category: req.category,
          name: req.name,
          description: req.description,
          traits: req.traits,
          relationships: req.relationships,
        },
        req.instruction,
        { settings: ragCtx.settings, characters: ragCtx.characters },
      );

      const result = await generateText(ctx.llm, prompt);
      return {
        updatedCharacters: [],
        parsedSummary: result,
      };
    },

    async editCharacterDocument(req) {
      const ctx = getContext();
      const novelId = req.novelId;

      const ragCtx = await searchContext(
        ctx.vectorStore,
        ctx.embedding,
        novelId,
        { query: req.instruction },
        ctx.env,
      );

      const prompt = editCharacterDocument(req.markdown, req.instruction, {
        settings: ragCtx.settings,
        characters: ragCtx.characters,
      });

      const result = await generateText(ctx.llm, prompt);
      return {
        updatedCharacters: [],
        parsedSummary: result,
      };
    },
  });
}
