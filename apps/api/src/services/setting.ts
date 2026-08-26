import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { and, eq } from 'drizzle-orm';
import { settings } from '@novel-creator/db';
import {
  createSettingDraft,
  editSetting,
  editSettingDocument,
  editSettingSection,
  generateJSON,
  generateText,
} from '@novel-creator/llm';
import { SettingService } from '@novel-creator/proto';
import {
  diffSettings,
  parseSettingsMarkdown,
  serializeSettingsToMarkdown,
} from '@novel-creator/shared';

import type { AppContext } from '../context.js';
import { searchContext, upsertEntityEmbedding } from '../rag.js';

function formatSetting(row: typeof settings.$inferSelect) {
  return {
    id: row.id,
    novelId: row.novelId,
    category: row.category,
    name: row.name,
    description: row.description ?? undefined,
    metadataJson: JSON.stringify(row.metadata ?? {}),
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

function settingToText(s: { category: string; name: string; description?: string | null }): string {
  return `[${s.category}] ${s.name}\n${s.description ?? ''}`;
}

export function registerSettingService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(SettingService, {
    async listSettings(req) {
      const db = getContext().db;
      const conditions = [eq(settings.novelId, req.novelId)];
      if (req.category) {
        conditions.push(eq(settings.category, req.category));
      }
      const rows = await db
        .select()
        .from(settings)
        .where(and(...conditions));
      return {
        settings: rows.map(formatSetting),
      };
    },

    async getSetting(req) {
      const db = getContext().db;
      const [setting] = await db.select().from(settings).where(eq(settings.id, req.id));
      if (!setting) {
        throw new ConnectError('Setting not found', Code.NotFound);
      }
      return formatSetting(setting);
    },

    async createSetting(req) {
      const ctx = getContext();
      const db = ctx.db;
      if (!req.name.trim()) {
        throw new ConnectError('Name is required', Code.InvalidArgument);
      }
      let meta = {};
      try {
        if (req.metadataJson) {
          meta = JSON.parse(req.metadataJson);
        }
      } catch {
        meta = {};
      }

      const [row] = await db
        .insert(settings)
        .values({
          novelId: req.novelId,
          category: req.category,
          name: req.name,
          description: req.description ?? null,
          metadata: meta,
        })
        .returning();

      await upsertEntityEmbedding(
        ctx.vectorStore,
        ctx.embedding,
        row.novelId,
        'setting',
        row.id,
        settingToText(row),
        ctx.env,
      );

      return formatSetting(row);
    },

    async updateSetting(req) {
      const ctx = getContext();
      const db = ctx.db;
      let metaUpdate: Record<string, unknown> | undefined;
      if (req.metadataJson !== undefined) {
        try {
          metaUpdate = JSON.parse(req.metadataJson);
        } catch {
          metaUpdate = {};
        }
      }

      const [row] = await db
        .update(settings)
        .set({
          ...(req.category !== undefined ? { category: req.category } : {}),
          ...(req.name !== undefined ? { name: req.name } : {}),
          ...(req.description !== undefined ? { description: req.description } : {}),
          ...(metaUpdate !== undefined ? { metadata: metaUpdate } : {}),
          updatedAt: new Date(),
        })
        .where(eq(settings.id, req.id))
        .returning();
      if (!row) {
        throw new ConnectError('Setting not found', Code.NotFound);
      }

      await upsertEntityEmbedding(
        ctx.vectorStore,
        ctx.embedding,
        row.novelId,
        'setting',
        row.id,
        settingToText(row),
        ctx.env,
      );

      return formatSetting(row);
    },

    async deleteSetting(req) {
      const ctx = getContext();
      const db = ctx.db;
      const [row] = await db.delete(settings).where(eq(settings.id, req.id)).returning();
      if (!row) {
        throw new ConnectError('Setting not found', Code.NotFound);
      }
      try {
        await ctx.vectorStore.deleteByEntity('setting', req.id);
      } catch (err) {
        console.error('[vector] failed to delete setting embedding', err);
      }
      return { success: true };
    },

    async editSetting(req) {
      const ctx = getContext();
      const db = ctx.db;
      const [setting] = await db.select().from(settings).where(eq(settings.id, req.id));
      if (!setting) {
        throw new ConnectError('Setting not found', Code.NotFound);
      }

      const prompt = editSetting(
        {
          category: setting.category,
          name: setting.name,
          description: setting.description ?? undefined,
        },
        req.instruction,
      );

      const result = await generateJSON<{
        category: string;
        name: string;
        description: string;
      }>(ctx.llm, prompt);

      const [row] = await db
        .update(settings)
        .set({
          category: result.category,
          name: result.name,
          description: result.description,
          updatedAt: new Date(),
        })
        .where(eq(settings.id, req.id))
        .returning();

      await upsertEntityEmbedding(
        ctx.vectorStore,
        ctx.embedding,
        row.novelId,
        'setting',
        row.id,
        settingToText(row),
        ctx.env,
      );

      return formatSetting(row);
    },

    async generateDraft(req) {
      const ctx = getContext();
      const prompt = createSettingDraft(req.query, {
        category: req.category,
        name: '',
        description: '',
      });
      const result = await generateJSON<{
        category: string;
        name: string;
        description: string;
      }>(ctx.llm, prompt);

      return {
        name: result.name,
        description: result.description,
        category: result.category,
        metadataJson: '{}',
      };
    },

    async getSettingsMarkdown(req) {
      const db = getContext().db;
      const rows = await db.select().from(settings).where(eq(settings.novelId, req.novelId));
      const markdown = serializeSettingsToMarkdown(rows);
      return { markdown };
    },

    async saveSettingsMarkdown(req) {
      const ctx = getContext();
      const db = ctx.db;
      const novelId = req.novelId;
      const existing = await db.select().from(settings).where(eq(settings.novelId, novelId));
      const parsed = parseSettingsMarkdown(req.markdown);
      const diff = diffSettings(existing, parsed);

      const createdIds: string[] = [];
      await db.transaction(async (tx) => {
        for (const s of diff.toCreate) {
          const [row] = await tx
            .insert(settings)
            .values({
              novelId,
              name: s.name,
              category: s.category,
              description: s.description,
            })
            .returning();
          createdIds.push(row.id);
        }

        for (const u of diff.toUpdate) {
          await tx
            .update(settings)
            .set({
              category: u.category,
              description: u.description,
              updatedAt: new Date(),
            })
            .where(eq(settings.id, u.id));
        }

        for (const id of diff.toDelete) {
          await tx.delete(settings).where(eq(settings.id, id));
        }
      });

      for (let i = 0; i < diff.toCreate.length; i++) {
        const s = diff.toCreate[i];
        await upsertEntityEmbedding(
          ctx.vectorStore,
          ctx.embedding,
          novelId,
          'setting',
          createdIds[i],
          settingToText(s),
          ctx.env,
        );
      }
      for (const u of diff.toUpdate) {
        await upsertEntityEmbedding(
          ctx.vectorStore,
          ctx.embedding,
          novelId,
          'setting',
          u.id,
          settingToText(u),
          ctx.env,
        );
      }
      for (const id of diff.toDelete) {
        await ctx.vectorStore.deleteByEntity('setting', id);
      }

      const updated = await db.select().from(settings).where(eq(settings.novelId, novelId));

      return {
        settings: updated.map(formatSetting),
        createdCount: diff.toCreate.length,
        updatedCount: diff.toUpdate.length,
        deletedCount: diff.toDelete.length,
      };
    },

    async editSettingSection(req) {
      const ctx = getContext();
      const novelId = req.novelId;

      const ragCtx = await searchContext(
        ctx.vectorStore,
        ctx.embedding,
        novelId,
        { query: `${req.description} ${req.instruction}` },
        ctx.env,
      );

      const prompt = editSettingSection(
        { category: req.category, name: req.name, description: req.description },
        req.instruction,
        {
          settings: ragCtx.settings,
          characters: ragCtx.characters,
        },
      );

      const result = await generateText(ctx.llm, prompt);
      return {
        updatedSettings: [],
        parsedSummary: result,
      };
    },

    async editSettingDocument(req) {
      const ctx = getContext();
      const novelId = req.novelId;

      const ragCtx = await searchContext(
        ctx.vectorStore,
        ctx.embedding,
        novelId,
        { query: req.instruction },
        ctx.env,
      );

      const prompt = editSettingDocument(req.markdown, req.instruction, {
        settings: ragCtx.settings,
        characters: ragCtx.characters,
      });

      const result = await generateText(ctx.llm, prompt);
      return {
        updatedSettings: [],
        parsedSummary: result,
      };
    },
  });
}
