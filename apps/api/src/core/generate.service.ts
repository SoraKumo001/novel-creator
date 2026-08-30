import { eq } from 'drizzle-orm';
import type { LanguageModel } from 'ai';
import {
  chapters,
  contents,
  foreshadowings,
  llmConfigs,
  novels,
  sections,
  timelines,
} from '@novel-creator/db';
import {
  analyzeSettingImpactPrompt,
  chapterSummary,
  contentGeneration,
  createLanguageModelFromConfig,
  extractSettings,
  extractTimeline,
  generateJSON,
  generateText,
  generateStyleGuideDraftPrompt,
  inlineAssistPrompt,
  plotGeneration,
  proofreadPrompt,
  sectionSummary,
  streamText,
  type InlineAssistAction,
} from '@novel-creator/llm';
import { searchContext } from '../rag.js';
import { assertFound, type ServiceContext } from './types.js';

export class GenerateDomainService {
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

  async generatePlot(novelId: string, modelConfigId?: string | null) {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, novelId));
    assertFound(novel, 'Novel not found');

    const context = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      novelId,
      {
        query: `${novel.title} ${novel.description ?? ''}`,
      },
      this.ctx.env,
    );

    const prompt = plotGeneration({
      title: novel.title,
      description: novel.description ?? '',
      settings: context.settings,
      characters: context.characters,
    });

    const llm = await this.resolveModel(modelConfigId);
    return generateJSON<{
      title: string;
      description: string;
      chapters: { title: string; order: number; summary: string }[];
    }>(llm, prompt);
  }

  async generateChapterSummary(chapterId: string) {
    const [chapter] = await this.ctx.db.select().from(chapters).where(eq(chapters.id, chapterId));
    assertFound(chapter, 'Chapter not found');
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, chapter.novelId));
    assertFound(novel, 'Novel not found');

    const prompt = chapterSummary(
      { title: novel.title, description: novel.description ?? '' },
      { title: chapter.title, order: chapter.order, summary: chapter.summary ?? undefined },
    );

    const result = await generateJSON<{ title: string; order: number; summary: string }>(
      this.ctx.llm,
      prompt,
    );

    await this.ctx.db
      .update(chapters)
      .set({ summary: result.summary, updatedAt: new Date() })
      .where(eq(chapters.id, chapterId));

    return result;
  }

  async generateSectionSummary(sectionId: string) {
    const [section] = await this.ctx.db.select().from(sections).where(eq(sections.id, sectionId));
    assertFound(section, 'Section not found');
    const [chapter] = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, section.chapterId));
    assertFound(chapter, 'Chapter not found');

    const prompt = sectionSummary(
      { title: chapter.title, summary: chapter.summary ?? '' },
      { title: section.title ?? undefined, order: section.order },
    );

    const result = await generateJSON<{ title: string; order: number; summary: string }>(
      this.ctx.llm,
      prompt,
    );

    await this.ctx.db
      .update(sections)
      .set({ summary: result.summary, updatedAt: new Date() })
      .where(eq(sections.id, sectionId));

    return result;
  }

  async *generateSectionContent(sectionId: string, modelConfigId?: string | null) {
    const [section] = await this.ctx.db.select().from(sections).where(eq(sections.id, sectionId));
    assertFound(section, 'Section not found');
    const [chapter] = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, section.chapterId));
    assertFound(chapter, 'Chapter not found');

    const previousSections = await this.ctx.db
      .select()
      .from(sections)
      .where(eq(sections.chapterId, section.chapterId))
      .orderBy(sections.order);
    const prevIndex = previousSections.findIndex((s) => s.id === sectionId);
    let previousContent: string | undefined;
    if (prevIndex > 0) {
      const prevSection = previousSections[prevIndex - 1];
      const [prevContent] = await this.ctx.db
        .select()
        .from(contents)
        .where(eq(contents.sectionId, prevSection.id));
      previousContent = prevContent?.body;
    }

    const ragContext = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      chapter.novelId,
      {
        query: `${section.title ?? ''} ${section.summary ?? ''}`,
        previousContent,
      },
      this.ctx.env,
    );

    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, chapter.novelId));

    const prompt = contentGeneration(
      { title: section.title ?? undefined, summary: section.summary ?? '' },
      {
        previousContent: ragContext.previousContent,
        characters: ragContext.characters,
        settings: ragContext.settings,
        styleGuide: novel?.styleGuide,
      },
    );

    const llm = await this.resolveModel(modelConfigId);
    for await (const chunk of streamText(llm, prompt)) {
      yield chunk;
    }
  }

  async extractEntities(sectionId: string) {
    const [section] = await this.ctx.db.select().from(sections).where(eq(sections.id, sectionId));
    assertFound(section, 'Section not found');
    const [content] = await this.ctx.db
      .select()
      .from(contents)
      .where(eq(contents.sectionId, sectionId));
    if (!content || !content.body.trim()) {
      return { characters: [], settings: [], timelines: [] };
    }

    const body = content.body;

    const [settingResult, timelineResult] = await Promise.all([
      generateJSON<{ name: string; category: string; description: string }[]>(
        this.ctx.llm,
        extractSettings(body, []),
      ).catch(() => []),
      generateJSON<{ time?: string; event: string; order: number }[]>(
        this.ctx.llm,
        extractTimeline(body),
      ).catch(() => []),
    ]);

    return {
      characters: [],
      settings: (settingResult ?? []).map((s) => ({
        name: s.name,
        category: s.category,
        description: s.description,
      })),
      timelines: (timelineResult ?? []).map((t) => ({
        event: t.event,
        timestamp: t.time ?? '',
        order: t.order,
      })),
    };
  }

  async proofreadContent(sectionId: string, customBody?: string, modelConfigId?: string | null) {
    const [section] = await this.ctx.db.select().from(sections).where(eq(sections.id, sectionId));
    assertFound(section, 'Section not found');

    const [chapter] = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, section.chapterId));
    const [novel] = chapter
      ? await this.ctx.db.select().from(novels).where(eq(novels.id, chapter.novelId))
      : [null];

    let bodyText = customBody;
    if (bodyText === undefined) {
      const [content] = await this.ctx.db
        .select()
        .from(contents)
        .where(eq(contents.sectionId, sectionId));
      bodyText = content?.body ?? '';
    }

    const context = novel
      ? await searchContext(
          this.ctx.vectorStore,
          this.ctx.embedding,
          novel.id,
          { query: bodyText || section.title || '' },
          this.ctx.env,
        )
      : { characters: [], settings: [] };

    const prompt = proofreadPrompt({
      novelTitle: novel?.title,
      chapterTitle: chapter?.title,
      sectionTitle: section.title ?? undefined,
      sectionSummary: section.summary ?? undefined,
      styleGuide: novel?.styleGuide ?? undefined,
      characters: context.characters.join('\n'),
      settings: context.settings.join('\n'),
      body: bodyText,
    });

    const llm = await this.resolveModel(modelConfigId);
    const result = await generateJSON<{
      score: number;
      critique: string;
      advice: string;
      issues: Array<{
        type: 'viewpoint' | 'typo' | 'grammar' | 'pacing' | 'consistency' | 'other';
        originalText: string;
        suggestion: string;
        reason: string;
      }>;
      polishedBody: string;
    }>(llm, prompt);

    return result;
  }

  async *inlineAssist(
    sectionId: string,
    input: {
      selectedText: string;
      action: InlineAssistAction;
      customInstruction?: string;
      surroundingText?: string;
      modelConfigId?: string | null;
    },
  ) {
    const [section] = await this.ctx.db.select().from(sections).where(eq(sections.id, sectionId));
    assertFound(section, 'Section not found');
    const [chapter] = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, section.chapterId));
    const [novel] = chapter
      ? await this.ctx.db.select().from(novels).where(eq(novels.id, chapter.novelId))
      : [null];

    const context = novel
      ? await searchContext(
          this.ctx.vectorStore,
          this.ctx.embedding,
          novel.id,
          { query: input.selectedText },
          this.ctx.env,
        )
      : { characters: [] };

    const prompt = inlineAssistPrompt({
      novelTitle: novel?.title,
      styleGuide: novel?.styleGuide ?? undefined,
      characters: context.characters.join('\n'),
      surroundingText: input.surroundingText,
      selectedText: input.selectedText,
      action: input.action,
      customInstruction: input.customInstruction,
    });

    const llm = await this.resolveModel(input.modelConfigId);
    for await (const chunk of streamText(llm, prompt)) {
      yield chunk;
    }
  }

  async generateStyleGuideDraft(novelId: string, modelConfigId?: string | null): Promise<string> {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, novelId));
    assertFound(novel, 'Novel not found');

    const context = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      novelId,
      {
        query: `${novel.title} ${novel.description ?? ''}`,
      },
      this.ctx.env,
    );

    const prompt = generateStyleGuideDraftPrompt({
      novelTitle: novel.title,
      description: novel.description,
      characters: context.characters,
      settings: context.settings,
    });

    const llm = await this.resolveModel(modelConfigId);
    return generateText(llm, prompt);
  }

  async analyzeSettingImpact(
    novelId: string,
    input: {
      changeTarget: 'character' | 'setting';
      targetName: string;
      beforeValue: string;
      afterValue: string;
      modelConfigId?: string | null;
    },
  ) {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, novelId));
    assertFound(novel, 'Novel not found');

    const chapterRows = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.novelId, novelId))
      .orderBy(chapters.order);

    const chaptersWithSections = await Promise.all(
      chapterRows.map(async (ch) => {
        const secRows = await this.ctx.db
          .select()
          .from(sections)
          .where(eq(sections.chapterId, ch.id))
          .orderBy(sections.order);
        return {
          title: ch.title,
          sections: secRows.map((s) => ({
            title: s.title ?? `節 ${s.order}`,
            summary: s.summary,
          })),
        };
      }),
    );

    const timelineRows = await this.ctx.db
      .select()
      .from(timelines)
      .where(eq(timelines.novelId, novelId))
      .orderBy(timelines.order);

    const foreshadowingRows = await this.ctx.db
      .select()
      .from(foreshadowings)
      .where(eq(foreshadowings.novelId, novelId));

    const prompt = analyzeSettingImpactPrompt({
      novelTitle: novel.title,
      changeTarget: input.changeTarget,
      targetName: input.targetName,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue,
      plots: novel.description ?? undefined,
      chapters: chaptersWithSections,
      timelines: timelineRows.map((t) => ({
        title: t.event,
        era: t.timestamp,
        description: t.event,
      })),
      foreshadowings: foreshadowingRows.map((f) => ({
        title: f.title,
        description: f.description,
      })),
    });

    const llm = await this.resolveModel(input.modelConfigId);
    return generateJSON<{
      summary: string;
      impactLevel: 'low' | 'medium' | 'high';
      affectedItems: Array<{
        targetType: 'plot' | 'section' | 'timeline' | 'foreshadowing';
        targetTitle: string;
        issue: string;
        suggestedFix: string;
      }>;
    }>(llm, prompt);
  }
}
