import { desc, eq } from 'drizzle-orm';
import type { LanguageModel } from 'ai';
import { chapters, characters, llmConfigs, novels, settings } from '@novel-creator/db';
import {
  createLanguageModelFromConfig,
  editStoryOutlineDocument,
  editStoryOutlineSection,
  generateJSON,
  generatePlotFromStoryOutline,
  generateText,
} from '@novel-creator/llm';
import { searchContext } from '../rag.js';
import { insertEditHistory } from './history.service.js';
import { assertFound, ValidationError, type ServiceContext } from './types.js';

export class NovelDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  private async resolveModel(modelConfigId?: string | null): Promise<LanguageModel> {
    if (modelConfigId) {
      const [customConfig] = await this.ctx.db
        .select()
        .from(llmConfigs)
        .where(eq(llmConfigs.id, modelConfigId));
      if (customConfig) {
        return createLanguageModelFromConfig(customConfig, this.ctx.env);
      }
    }
    const [defaultConfig] = await this.ctx.db
      .select()
      .from(llmConfigs)
      .where(eq(llmConfigs.isDefault, true));
    if (defaultConfig) {
      return createLanguageModelFromConfig(defaultConfig, this.ctx.env);
    }
    return this.ctx.llm;
  }

  async listNovels() {
    return this.ctx.db.select().from(novels).orderBy(desc(novels.createdAt));
  }

  async getNovelDetail(id: string) {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, id));
    assertFound(novel, 'Novel not found');

    const [chapterRows, characterRows, settingRows] = await Promise.all([
      this.ctx.db.select().from(chapters).where(eq(chapters.novelId, id)).orderBy(chapters.order),
      this.ctx.db.select().from(characters).where(eq(characters.novelId, id)),
      this.ctx.db.select().from(settings).where(eq(settings.novelId, id)),
    ]);

    return {
      novel,
      chapters: chapterRows,
      characters: characterRows,
      settings: settingRows,
    };
  }

  async createNovel(data: {
    title: string;
    description?: string | null;
    styleGuide?: string | null;
    storyOutline?: string | null;
  }) {
    if (!data.title?.trim()) {
      throw new ValidationError('Title is required');
    }
    const [row] = await this.ctx.db
      .insert(novels)
      .values({
        title: data.title,
        description: data.description ?? null,
        styleGuide: data.styleGuide ?? null,
        storyOutline: data.storyOutline ?? null,
      })
      .returning();
    return row;
  }

  async updateNovel(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      styleGuide?: string | null;
      storyOutline?: string | null;
    },
  ) {
    const [row] = await this.ctx.db
      .update(novels)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.styleGuide !== undefined ? { styleGuide: data.styleGuide } : {}),
        ...(data.storyOutline !== undefined ? { storyOutline: data.storyOutline } : {}),
        updatedAt: new Date(),
      })
      .where(eq(novels.id, id))
      .returning();
    assertFound(row, 'Novel not found');
    return row;
  }

  async getStoryOutline(id: string): Promise<string> {
    const [novel] = await this.ctx.db
      .select({ storyOutline: novels.storyOutline })
      .from(novels)
      .where(eq(novels.id, id));
    assertFound(novel, 'Novel not found');
    return novel.storyOutline ?? '';
  }

  async saveStoryOutline(id: string, markdown: string) {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, id));
    assertFound(novel, 'Novel not found');

    const previousMarkdown = novel.storyOutline ?? '';
    const [updated] = await this.ctx.db
      .update(novels)
      .set({
        storyOutline: markdown,
        updatedAt: new Date(),
      })
      .where(eq(novels.id, id))
      .returning();

    if (previousMarkdown.trim() !== markdown.trim()) {
      await insertEditHistory(this.ctx.db, {
        novelId: id,
        entityType: 'story_outline_markdown',
        entityId: id,
        title: `${novel.title} - ストーリー構想`,
        content: markdown,
        description: 'ストーリー構想マークダウンを更新',
        wordCount: markdown.length,
      });
    }

    return updated;
  }

  async editStoryOutlineSection(
    id: string,
    params: {
      activeSection: { category: string; name: string; content: string };
      instruction: string;
      markdown: string;
      modelConfigId?: string | null;
    },
  ): Promise<string> {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, id));
    assertFound(novel, 'Novel not found');

    const context = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      id,
      { query: `${params.activeSection.name} ${params.instruction}` },
      this.ctx.env,
    );

    const prompt = editStoryOutlineSection(params.activeSection, params.instruction, {
      novelTitle: novel.title,
      characters: context.characters,
      settings: context.settings,
      entireOutlinePreview: params.markdown.slice(0, 3000),
    });

    const llm = await this.resolveModel(params.modelConfigId);
    return generateText(llm, prompt);
  }

  async editStoryOutlineDocument(
    id: string,
    params: {
      instruction: string;
      markdown: string;
      modelConfigId?: string | null;
    },
  ): Promise<string> {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, id));
    assertFound(novel, 'Novel not found');

    const context = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      id,
      { query: `${novel.title} ${params.instruction}` },
      this.ctx.env,
    );

    const prompt = editStoryOutlineDocument(params.markdown, params.instruction, {
      novelTitle: novel.title,
      characters: context.characters,
      settings: context.settings,
    });

    const llm = await this.resolveModel(params.modelConfigId);
    return generateText(llm, prompt);
  }

  async generatePlotFromOutline(
    id: string,
    params: {
      storyOutline: string;
      modelConfigId?: string | null;
    },
  ) {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, id));
    assertFound(novel, 'Novel not found');

    const context = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      id,
      { query: `${novel.title} ${params.storyOutline.slice(0, 500)}` },
      this.ctx.env,
    );

    const prompt = generatePlotFromStoryOutline({
      novelTitle: novel.title,
      storyOutline: params.storyOutline,
      characters: context.characters,
      settings: context.settings,
    });

    const llm = await this.resolveModel(params.modelConfigId);
    return generateJSON<{
      title: string;
      description: string;
      chapters: { title: string; order: number; summary: string }[];
    }>(llm, prompt);
  }

  async deleteNovel(id: string) {
    const [row] = await this.ctx.db.delete(novels).where(eq(novels.id, id)).returning();
    assertFound(row, 'Novel not found');
    return row;
  }
}
