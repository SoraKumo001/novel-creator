import { eq } from 'drizzle-orm';
import type { LanguageModel } from 'ai';
import {
  chapters,
  characters,
  contents,
  foreshadowings,
  llmConfigs,
  novels,
  sections,
  timelines,
} from '@novel-creator/db';
import {
  analyzeSettingImpactPrompt,
  analyzeStoryArcPrompt,
  chapterSummary,
  checkCharacterVoicePrompt,
  contentGeneration,
  createLanguageModelFromConfig,
  extractSettings,
  extractTimeline,
  generateJSON,
  inlineAssistPrompt,
  multiPersonaReviewPrompt,
  plotGeneration,
  proofreadPrompt,
  sectionSummary,
  streamText,
  type InlineAssistAction,
  type ReaderPersonaType,
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

    const prompt = contentGeneration(
      { title: section.title ?? undefined, summary: section.summary ?? '' },
      {
        previousContent: ragContext.previousContent,
        characters: ragContext.characters,
        settings: ragContext.settings,
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

  async checkCharacterVoice(
    novelId: string,
    sectionId?: string,
    customBody?: string,
    modelConfigId?: string | null,
  ) {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, novelId));
    assertFound(novel, 'Novel not found');

    const characterRows = await this.ctx.db
      .select()
      .from(characters)
      .where(eq(characters.novelId, novelId));

    let bodyText = customBody;
    if (bodyText === undefined && sectionId) {
      const [content] = await this.ctx.db
        .select()
        .from(contents)
        .where(eq(contents.sectionId, sectionId));
      bodyText = content?.body ?? '';
    }

    const charactersFormatted = characterRows.map((char) => {
      let firstPerson: string | null = null;
      let secondPerson: string | null = null;
      let speechPattern: string | null = null;

      if (Array.isArray(char.traits)) {
        for (const trait of char.traits as string[]) {
          if (trait.includes('一人称')) firstPerson = trait;
          else if (trait.includes('二人称')) secondPerson = trait;
          else if (trait.includes('口調') || trait.includes('語尾')) speechPattern = trait;
        }
      }

      return {
        name: char.name,
        category: char.category,
        firstPerson,
        secondPerson,
        speechPattern,
        description: char.description,
      };
    });

    const prompt = checkCharacterVoicePrompt({
      novelTitle: novel.title,
      characters: charactersFormatted,
      body: bodyText ?? '',
    });

    const llm = await this.resolveModel(modelConfigId);
    return generateJSON<{
      summary: string;
      issues: Array<{
        characterName: string;
        dialogue: string;
        issueType:
          'firstPerson' | 'secondPerson' | 'speechPattern' | 'toneShift' | 'outOfCharacter';
        reason: string;
        suggestion: string;
      }>;
    }>(llm, prompt);
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

  async analyzeStoryArc(novelId: string, modelConfigId?: string | null) {
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

        const sectionsData = await Promise.all(
          secRows.map(async (s) => {
            const [content] = await this.ctx.db
              .select()
              .from(contents)
              .where(eq(contents.sectionId, s.id));
            const snippet = content?.body ? content.body.slice(0, 300) : undefined;
            return {
              id: s.id,
              title: s.title ?? `節 ${s.order}`,
              summary: s.summary,
              contentSnippet: snippet,
            };
          }),
        );

        return {
          id: ch.id,
          title: ch.title,
          sections: sectionsData,
        };
      }),
    );

    const prompt = analyzeStoryArcPrompt({
      novelTitle: novel.title,
      chapters: chaptersWithSections,
    });

    const llm = await this.resolveModel(modelConfigId);
    return generateJSON<{
      summary: string;
      pacingCritique: string;
      dataPoints: Array<{
        chapterId: string;
        chapterTitle: string;
        sectionId: string;
        sectionTitle: string;
        tension: number;
        valence: number;
        pacing: number;
        keyEvent: string;
        advice: string;
      }>;
    }>(llm, prompt);
  }

  async multiPersonaReview(
    novelId: string,
    input: {
      sectionId?: string;
      chapterId?: string;
      customBody?: string;
      modelConfigId?: string | null;
    },
  ) {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, novelId));
    assertFound(novel, 'Novel not found');

    let bodyText = input.customBody ?? '';
    let chapterTitle: string | undefined;
    let sectionTitle: string | undefined;

    if (input.sectionId) {
      const [sec] = await this.ctx.db
        .select()
        .from(sections)
        .where(eq(sections.id, input.sectionId));
      if (sec) {
        sectionTitle = sec.title ?? `節 ${sec.order}`;
        if (!bodyText) {
          const [content] = await this.ctx.db
            .select()
            .from(contents)
            .where(eq(contents.sectionId, sec.id));
          bodyText = content?.body ?? '';
        }
        const [ch] = await this.ctx.db
          .select()
          .from(chapters)
          .where(eq(chapters.id, sec.chapterId));
        if (ch) chapterTitle = ch.title;
      }
    } else if (input.chapterId) {
      const [ch] = await this.ctx.db
        .select()
        .from(chapters)
        .where(eq(chapters.id, input.chapterId));
      if (ch) {
        chapterTitle = ch.title;
        if (!bodyText) {
          const secRows = await this.ctx.db
            .select()
            .from(sections)
            .where(eq(sections.chapterId, ch.id))
            .orderBy(sections.order);
          const bodies: string[] = [];
          for (const s of secRows) {
            const [c] = await this.ctx.db
              .select()
              .from(contents)
              .where(eq(contents.sectionId, s.id));
            if (c?.body) bodies.push(`【${s.title ?? `節 ${s.order}`}】\n${c.body}`);
          }
          bodyText = bodies.join('\n\n');
        }
      }
    }

    const prompt = multiPersonaReviewPrompt({
      novelTitle: novel.title,
      chapterTitle,
      sectionTitle,
      text: bodyText,
    });

    const llm = await this.resolveModel(input.modelConfigId);
    return generateJSON<{
      overallImpression: string;
      reviews: Array<{
        persona: ReaderPersonaType;
        personaName: string;
        rating: number;
        catchphrase: string;
        praise: string;
        criticism: string;
        advice: string;
      }>;
    }>(llm, prompt);
  }
}
