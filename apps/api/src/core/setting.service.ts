import { settings } from "@novel-creator/db";
import {
  createSettingDraft,
  editSetting,
  editSettingDocument,
  editSettingSection,
  generateJSON,
  generateText,
} from "@novel-creator/llm";
import {
  diffSettings,
  parseSettingsMarkdown,
  serializeSettingsToMarkdown,
} from "@novel-creator/shared";
import { and, eq, inArray } from "drizzle-orm";
import { appLogger } from "../middleware/logger.js";
import { searchContext, upsertEntityEmbedding } from "../rag.js";
import { insertEditHistory } from "./history.service.js";
import { assertFound, type ServiceContext, ValidationError } from "./types.js";

export function settingToText(s: {
  category: string;
  name: string;
  description?: string | null;
}): string {
  return `[${s.category}] ${s.name}\n${s.description ?? ""}`;
}

export class SettingDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listSettings(novelId: string, category?: string) {
    const conditions = [eq(settings.novelId, novelId)];
    if (category) {
      conditions.push(eq(settings.category, category));
    }
    return this.ctx.db
      .select()
      .from(settings)
      .where(and(...conditions));
  }

  async getSetting(id: string) {
    const [setting] = await this.ctx.db
      .select()
      .from(settings)
      .where(eq(settings.id, id));
    assertFound(setting, "Setting not found");
    return setting;
  }

  async createSetting(data: {
    novelId: string;
    category: string;
    name: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    if (!data.name?.trim()) {
      throw new ValidationError("Name is required");
    }

    const [row] = await this.ctx.db
      .insert(settings)
      .values({
        category: data.category,
        description: data.description ?? null,
        metadata: data.metadata ?? {},
        name: data.name,
        novelId: data.novelId,
      })
      .returning();

    await upsertEntityEmbedding(
      this.ctx.vectorStore,
      this.ctx.embedding,
      row.novelId,
      "setting",
      row.id,
      settingToText(row),
      this.ctx.env
    );

    return row;
  }

  async updateSetting(
    id: string,
    data: {
      category?: string;
      name?: string;
      description?: string | null;
      metadata?: Record<string, unknown>;
    }
  ) {
    const [row] = await this.ctx.db
      .update(settings)
      .set({
        ...(data.category === undefined ? {} : { category: data.category }),
        ...(data.name === undefined ? {} : { name: data.name }),
        ...(data.description === undefined
          ? {}
          : { description: data.description }),
        ...(data.metadata === undefined ? {} : { metadata: data.metadata }),
        updatedAt: new Date(),
      })
      .where(eq(settings.id, id))
      .returning();
    assertFound(row, "Setting not found");

    try {
      await insertEditHistory(this.ctx.db, {
        content: JSON.stringify({
          category: row.category,
          description: row.description ?? "",
          name: row.name,
        }),
        description: "設定の更新",
        entityId: row.id,
        entityType: "setting",
        novelId: row.novelId,
        title: row.name,
      });
    } catch (e) {
      appLogger.warn("failed to record setting history", e);
    }

    await upsertEntityEmbedding(
      this.ctx.vectorStore,
      this.ctx.embedding,
      row.novelId,
      "setting",
      row.id,
      settingToText(row),
      this.ctx.env
    );

    return row;
  }

  async deleteSetting(id: string) {
    const [row] = await this.ctx.db
      .delete(settings)
      .where(eq(settings.id, id))
      .returning();
    assertFound(row, "Setting not found");
    try {
      await this.ctx.vectorStore.deleteByEntity("setting", id);
    } catch (err) {
      appLogger.warn("failed to delete setting embedding", err);
    }
    return row;
  }

  async editSettingWithInstruction(id: string, instruction: string) {
    const setting = await this.getSetting(id);

    const prompt = editSetting(
      {
        category: setting.category,
        description: setting.description ?? undefined,
        name: setting.name,
      },
      instruction
    );

    const result = await generateJSON<{
      category: string;
      name: string;
      description: string;
    }>(this.ctx.llm, prompt);

    const [row] = await this.ctx.db
      .update(settings)
      .set({
        category: result.category,
        description: result.description,
        name: result.name,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, id))
      .returning();

    await upsertEntityEmbedding(
      this.ctx.vectorStore,
      this.ctx.embedding,
      row.novelId,
      "setting",
      row.id,
      settingToText(row),
      this.ctx.env
    );

    return row;
  }

  async generateDraft(
    query: string,
    currentDraft?: { category: string; name: string; description?: string }
  ) {
    const prompt = createSettingDraft(query, currentDraft);
    return generateJSON<{
      category: string;
      name: string;
      description: string;
    }>(this.ctx.llm, prompt);
  }

  async getMarkdown(novelId: string) {
    const rows = await this.ctx.db
      .select()
      .from(settings)
      .where(eq(settings.novelId, novelId));
    return serializeSettingsToMarkdown(rows);
  }

  async saveMarkdown(novelId: string, markdown: string) {
    const existing = await this.ctx.db
      .select()
      .from(settings)
      .where(eq(settings.novelId, novelId));
    const parsed = parseSettingsMarkdown(markdown);
    const diff = diffSettings(existing, parsed);

    const createdIds: string[] = [];
    await this.ctx.db.transaction(async (tx) => {
      if (diff.toCreate.length > 0) {
        const rows = await tx
          .insert(settings)
          .values(
            diff.toCreate.map((s) => ({
              category: s.category,
              description: s.description,
              name: s.name,
              novelId,
            }))
          )
          .returning();
        createdIds.push(...rows.map((row) => row.id));
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

      if (diff.toDelete.length > 0) {
        await tx.delete(settings).where(inArray(settings.id, diff.toDelete));
      }
    });

    for (let i = 0; i < diff.toCreate.length; i++) {
      const s = diff.toCreate[i];
      await upsertEntityEmbedding(
        this.ctx.vectorStore,
        this.ctx.embedding,
        novelId,
        "setting",
        createdIds[i],
        settingToText(s),
        this.ctx.env
      );
    }
    for (const u of diff.toUpdate) {
      await upsertEntityEmbedding(
        this.ctx.vectorStore,
        this.ctx.embedding,
        novelId,
        "setting",
        u.id,
        settingToText(u),
        this.ctx.env
      );
    }
    for (const id of diff.toDelete) {
      await this.ctx.vectorStore.deleteByEntity("setting", id);
    }

    const updated = await this.ctx.db
      .select()
      .from(settings)
      .where(eq(settings.novelId, novelId));

    try {
      await insertEditHistory(this.ctx.db, {
        content: markdown,
        description: `マークダウン一括保存 (作成: ${diff.toCreate.length}, 更新: ${diff.toUpdate.length}, 削除: ${diff.toDelete.length})`,
        entityId: novelId,
        entityType: "settings_markdown",
        novelId,
        title: "設定マークダウン",
        wordCount: markdown.length,
      });
    } catch (e) {
      appLogger.warn("failed to record settings_markdown history", e);
    }

    return {
      createdCount: diff.toCreate.length,
      deletedCount: diff.toDelete.length,
      settings: updated,
      updatedCount: diff.toUpdate.length,
    };
  }

  async editSettingSection(data: {
    novelId: string;
    category: string;
    name: string;
    description: string;
    instruction: string;
  }) {
    const ragCtx = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      data.novelId,
      { query: `${data.description} ${data.instruction}` },
      this.ctx.env
    );

    const prompt = editSettingSection(
      {
        category: data.category,
        description: data.description,
        name: data.name,
      },
      data.instruction,
      {
        characters: ragCtx.characters,
        settings: ragCtx.settings,
      }
    );

    return generateText(this.ctx.llm, prompt);
  }

  async editSettingDocument(
    novelId: string,
    markdown: string,
    instruction: string
  ) {
    const ragCtx = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      novelId,
      { query: instruction },
      this.ctx.env
    );

    const prompt = editSettingDocument(markdown, instruction, {
      characters: ragCtx.characters,
      settings: ragCtx.settings,
    });

    return generateText(this.ctx.llm, prompt);
  }
}
