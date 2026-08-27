import { eq } from 'drizzle-orm';
import { chapters, contents, novels, sections } from '@novel-creator/db';
import {
  chapterSummary,
  contentGeneration,
  extractSettings,
  extractTimeline,
  generateJSON,
  plotGeneration,
  sectionSummary,
  streamText,
} from '@novel-creator/llm';
import { searchContext } from '../rag.js';
import { NotFoundError, type ServiceContext } from './types.js';

export class GenerateDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async generatePlot(novelId: string) {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, novelId));
    if (!novel) {
      throw new NotFoundError('Novel not found');
    }

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

    return generateJSON<{
      title: string;
      description: string;
      chapters: { title: string; order: number; summary: string }[];
    }>(this.ctx.llm, prompt);
  }

  async generateChapterSummary(chapterId: string) {
    const [chapter] = await this.ctx.db.select().from(chapters).where(eq(chapters.id, chapterId));
    if (!chapter) {
      throw new NotFoundError('Chapter not found');
    }
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, chapter.novelId));
    if (!novel) {
      throw new NotFoundError('Novel not found');
    }

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
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    const [chapter] = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, section.chapterId));
    if (!chapter) {
      throw new NotFoundError('Chapter not found');
    }

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

  async *generateSectionContent(sectionId: string) {
    const [section] = await this.ctx.db.select().from(sections).where(eq(sections.id, sectionId));
    if (!section) {
      throw new NotFoundError('Section not found');
    }
    const [chapter] = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, section.chapterId));
    if (!chapter) {
      throw new NotFoundError('Chapter not found');
    }

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

    for await (const chunk of streamText(this.ctx.llm, prompt)) {
      yield chunk;
    }
  }

  async extractEntities(sectionId: string) {
    const [section] = await this.ctx.db.select().from(sections).where(eq(sections.id, sectionId));
    if (!section) {
      throw new NotFoundError('Section not found');
    }
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
}
