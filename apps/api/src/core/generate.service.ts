import {
  chapters,
  contents,
  customPrompts,
  foreshadowings,
  novels,
  sections,
  timelines,
} from "@novel-creator/db";
import {
  analyzeSettingImpactPrompt,
  chapterSummary,
  contentGeneration,
  extractSettings,
  extractTimeline,
  generateJSON,
  generateStyleGuideDraftPrompt,
  generateText,
  type InlineAssistAction,
  inlineAssistPrompt,
  plotGeneration,
  proofreadPrompt,
  sectionSummary,
  streamText,
} from "@novel-creator/llm";
import { eq } from "drizzle-orm";
import { searchContext } from "../rag.js";
import { mergeAsyncIterables } from "./merge-async-iterables.js";
import { resolveLLMModel } from "./model-resolver.js";
import { fetchNovelStructureWithContents } from "./novel-structure.js";
import { assertFound, type ServiceContext } from "./types.js";

/**
 * ストリームの各チャンクにバリアント番号をタグ付けする。
 */
async function* withVariant(
  stream: AsyncIterable<string>,
  variant: number
): AsyncGenerator<{ text: string; variant: number }> {
  for await (const chunk of stream) {
    yield { text: chunk, variant };
  }
}

/**
 * resolveSectionContext の戻り値。プロンプト組立に必要な行と、RAG 検索結果を
 * プロンプトにそのまま渡せる形（改行連結済み文字列）にしたもの。
 */
interface SectionPromptContext {
  chapter: typeof chapters.$inferSelect | null;
  characters: string;
  novel: typeof novels.$inferSelect | null;
  section: typeof sections.$inferSelect;
  settings: string;
}

export class GenerateDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async generatePlot(novelId: string, modelConfigId?: string | null) {
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, novelId));
    assertFound(novel, "Novel not found");

    const context = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      novelId,
      {
        query: `${novel.title} ${novel.description ?? ""}`,
      },
      this.ctx.env
    );

    const prompt = plotGeneration({
      characters: context.characters,
      description: novel.description ?? "",
      settings: context.settings,
      title: novel.title,
    });

    const llm = await resolveLLMModel(this.ctx, modelConfigId, "throw");
    return generateJSON<{
      title: string;
      description: string;
      chapters: { title: string; order: number; summary: string }[];
    }>(llm, prompt);
  }

  async generateChapterSummary(chapterId: string) {
    const [chapter] = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, chapterId));
    assertFound(chapter, "Chapter not found");
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, chapter.novelId));
    assertFound(novel, "Novel not found");

    const prompt = chapterSummary(
      { description: novel.description ?? "", title: novel.title },
      {
        order: chapter.order,
        summary: chapter.summary ?? undefined,
        title: chapter.title,
      }
    );

    const result = await generateJSON<{
      title: string;
      order: number;
      summary: string;
    }>(this.ctx.llm, prompt);

    await this.ctx.db
      .update(chapters)
      .set({ summary: result.summary, updatedAt: new Date() })
      .where(eq(chapters.id, chapterId));

    return result;
  }

  async generateSectionSummary(sectionId: string) {
    const [section] = await this.ctx.db
      .select()
      .from(sections)
      .where(eq(sections.id, sectionId));
    assertFound(section, "Section not found");
    const [chapter] = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, section.chapterId));
    assertFound(chapter, "Chapter not found");

    const prompt = sectionSummary(
      { summary: chapter.summary ?? "", title: chapter.title },
      { order: section.order, title: section.title ?? undefined }
    );

    const result = await generateJSON<{
      title: string;
      order: number;
      summary: string;
    }>(this.ctx.llm, prompt);

    await this.ctx.db
      .update(sections)
      .set({ summary: result.summary, updatedAt: new Date() })
      .where(eq(sections.id, sectionId));

    return result;
  }

  async *generateSectionContent(
    sectionId: string,
    modelConfigId?: string | null
  ) {
    const [section] = await this.ctx.db
      .select()
      .from(sections)
      .where(eq(sections.id, sectionId));
    assertFound(section, "Section not found");
    const [chapter] = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, section.chapterId));
    assertFound(chapter, "Chapter not found");

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
        previousContent,
        query: `${section.title ?? ""} ${section.summary ?? ""}`,
      },
      this.ctx.env
    );

    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, chapter.novelId));

    const prompt = contentGeneration(
      { summary: section.summary ?? "", title: section.title ?? undefined },
      {
        characters: ragContext.characters,
        previousContent: ragContext.previousContent,
        settings: ragContext.settings,
        styleGuide: novel?.styleGuide,
      }
    );

    const llm = await resolveLLMModel(this.ctx, modelConfigId, "throw");
    for await (const chunk of streamText(llm, prompt)) {
      yield chunk;
    }
  }

  async extractEntities(sectionId: string) {
    const [section] = await this.ctx.db
      .select()
      .from(sections)
      .where(eq(sections.id, sectionId));
    assertFound(section, "Section not found");
    const [content] = await this.ctx.db
      .select()
      .from(contents)
      .where(eq(contents.sectionId, sectionId));
    if (!content?.body.trim()) {
      return { characters: [], settings: [], timelines: [] };
    }

    const body = content.body;

    const [settingResult, timelineResult] = await Promise.all([
      generateJSON<{ name: string; category: string; description: string }[]>(
        this.ctx.llm,
        extractSettings(body, [])
      ).catch(() => []),
      generateJSON<{ time?: string; event: string; order: number }[]>(
        this.ctx.llm,
        extractTimeline(body)
      ).catch(() => []),
    ]);

    return {
      characters: [],
      settings: (settingResult ?? []).map((s) => ({
        category: s.category,
        description: s.description,
        name: s.name,
      })),
      timelines: (timelineResult ?? []).map((t) => ({
        event: t.event,
        order: t.order,
        timestamp: t.time ?? "",
      })),
    };
  }

  /**
   * proofreadContent / inlineAssist 共通のコンテキスト解決。
   * 節を取得して章・小説をたどり、小説が判明すれば RAG で関連キャラクター・設定を検索する。
   * ragQuery は検索クエリ文字列を組み立てる関数（proofreadContent は本文と節タイトル、
   * inlineAssist は選択テキストをクエリに使う）。
   */
  private async resolveSectionContext(
    sectionId: string,
    buildRagQuery: (section: typeof sections.$inferSelect) => string
  ): Promise<SectionPromptContext> {
    const [section] = await this.ctx.db
      .select()
      .from(sections)
      .where(eq(sections.id, sectionId));
    assertFound(section, "Section not found");

    const [chapter] = await this.ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, section.chapterId));
    const [novel] = chapter
      ? await this.ctx.db
          .select()
          .from(novels)
          .where(eq(novels.id, chapter.novelId))
      : [null];

    const context = novel
      ? await searchContext(
          this.ctx.vectorStore,
          this.ctx.embedding,
          novel.id,
          { query: buildRagQuery(section) },
          this.ctx.env
        )
      : { characters: [], settings: [] };

    return {
      chapter: chapter ?? null,
      characters: context.characters.join("\n"),
      novel: novel ?? null,
      section,
      settings: context.settings.join("\n"),
    };
  }

  async proofreadContent(
    sectionId: string,
    customBody?: string,
    modelConfigId?: string | null
  ) {
    let bodyText = customBody;
    if (bodyText === undefined) {
      const [content] = await this.ctx.db
        .select()
        .from(contents)
        .where(eq(contents.sectionId, sectionId));
      bodyText = content?.body ?? "";
    }

    const { section, chapter, novel, characters, settings } =
      await this.resolveSectionContext(
        sectionId,
        (section) => bodyText || section.title || ""
      );

    const prompt = proofreadPrompt({
      body: bodyText,
      chapterTitle: chapter?.title,
      characters,
      novelTitle: novel?.title,
      sectionSummary: section.summary ?? undefined,
      sectionTitle: section.title ?? undefined,
      settings,
      styleGuide: novel?.styleGuide ?? undefined,
    });

    const llm = await resolveLLMModel(this.ctx, modelConfigId, "throw");
    const result = await generateJSON<{
      score: number;
      critique: string;
      advice: string;
      issues: Array<{
        type:
          | "viewpoint"
          | "typo"
          | "grammar"
          | "pacing"
          | "consistency"
          | "other";
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
      customPromptId?: string | null;
      surroundingText?: string;
      modelConfigId?: string | null;
      variantCount?: number;
    }
  ): AsyncIterable<{ text: string; variant: number }> {
    const { section, chapter, novel, characters, settings } =
      await this.resolveSectionContext(sectionId, () => input.selectedText);

    let action = input.action;
    let customTemplate: string | undefined;

    if (input.customPromptId) {
      const [promptRecord] = await this.ctx.db
        .select()
        .from(customPrompts)
        .where(eq(customPrompts.id, input.customPromptId));
      if (promptRecord) {
        action = "template";
        customTemplate = promptRecord.userPrompt;
      }
    }

    const totalVariants = Math.max(1, Math.min(3, input.variantCount ?? 1));
    const llm = await resolveLLMModel(this.ctx, input.modelConfigId, "throw");

    const buildPrompt = (variantIndex: number) =>
      inlineAssistPrompt({
        action,
        chapterTitle: chapter?.title,
        characters,
        customInstruction: input.customInstruction,
        customTemplate,
        novelTitle: novel?.title,
        sectionSummary: section.summary ?? undefined,
        sectionTitle: section.title ?? undefined,
        selectedText: input.selectedText,
        settings,
        styleGuide: novel?.styleGuide ?? undefined,
        surroundingText: input.surroundingText,
        totalVariants,
        variantIndex,
      });

    // 単一生成の場合
    if (totalVariants === 1) {
      for await (const chunk of streamText(llm, buildPrompt(1))) {
        yield { text: chunk, variant: 0 };
      }
      return;
    }

    // 複数バリエーション並列生成の場合（チャンクにバリアント番号を付けて到着順にマージする）
    const streams: AsyncGenerator<{ text: string; variant: number }>[] = [];
    for (let v = 0; v < totalVariants; v++) {
      streams.push(withVariant(streamText(llm, buildPrompt(v + 1)), v));
    }

    yield* mergeAsyncIterables(streams);
  }

  async generateStyleGuideDraft(
    novelId: string,
    modelConfigId?: string | null
  ): Promise<string> {
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, novelId));
    assertFound(novel, "Novel not found");

    const context = await searchContext(
      this.ctx.vectorStore,
      this.ctx.embedding,
      novelId,
      {
        query: `${novel.title} ${novel.description ?? ""}`,
      },
      this.ctx.env
    );

    const prompt = generateStyleGuideDraftPrompt({
      characters: context.characters,
      description: novel.description,
      novelTitle: novel.title,
      settings: context.settings,
    });

    const llm = await resolveLLMModel(this.ctx, modelConfigId, "throw");
    return generateText(llm, prompt);
  }

  async analyzeSettingImpact(
    novelId: string,
    input: {
      changeTarget: "character" | "setting";
      targetName: string;
      beforeValue: string;
      afterValue: string;
      modelConfigId?: string | null;
    }
  ) {
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, novelId));
    assertFound(novel, "Novel not found");

    // 章・節の構造（本文は不要）を共通ヘルパで一括取得（従来の章ごとの節 SELECT を解消）
    const structure = await fetchNovelStructureWithContents(
      this.ctx.db,
      [novelId],
      {
        contentMode: "none",
      }
    );
    const chaptersWithSections = (structure.get(novelId) ?? []).map((node) => ({
      sections: node.sections.map(({ section }) => ({
        summary: section.summary,
        title: section.title ?? `節 ${section.order}`,
      })),
      title: node.chapter.title,
    }));

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
      afterValue: input.afterValue,
      beforeValue: input.beforeValue,
      changeTarget: input.changeTarget,
      chapters: chaptersWithSections,
      foreshadowings: foreshadowingRows.map((f) => ({
        description: f.description,
        title: f.title,
      })),
      novelTitle: novel.title,
      plots: novel.description ?? undefined,
      targetName: input.targetName,
      timelines: timelineRows.map((t) => ({
        description: t.event,
        era: t.timestamp,
        title: t.event,
      })),
    });

    const llm = await resolveLLMModel(this.ctx, input.modelConfigId, "throw");
    return generateJSON<{
      summary: string;
      impactLevel: "low" | "medium" | "high";
      affectedItems: Array<{
        targetType: "plot" | "section" | "timeline" | "foreshadowing";
        targetTitle: string;
        issue: string;
        suggestedFix: string;
      }>;
    }>(llm, prompt);
  }
}
