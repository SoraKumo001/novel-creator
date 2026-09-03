import {
  contents,
  customPrompts,
  foreshadowings,
  novels,
  timelines,
} from "@novel-creator/db";
import {
  analyzeSettingImpactPrompt,
  generateJSON,
  generateStyleGuideDraftPrompt,
  generateText,
  type InlineAssistAction,
  inlineAssistPrompt,
  proofreadPrompt,
  streamText,
} from "@novel-creator/llm";
import { eq } from "drizzle-orm";
import { searchContext } from "../../rag.js";
import { mergeAsyncIterables } from "../merge-async-iterables.js";
import { resolveLLMModel } from "../model-resolver.js";
import { fetchNovelStructureWithContents } from "../novel-structure.js";
import { assertFound, type ServiceContext } from "../types.js";
import { resolveSectionPromptContext, withVariant } from "./section-context.js";

export async function proofreadContentOp(
  ctx: ServiceContext,
  sectionId: string,
  customBody?: string,
  modelConfigId?: string | null
) {
  let bodyText = customBody;
  if (bodyText === undefined) {
    const [content] = await ctx.db
      .select()
      .from(contents)
      .where(eq(contents.sectionId, sectionId));
    bodyText = content?.body ?? "";
  }

  const { section, chapter, novel, characters, settings } =
    await resolveSectionPromptContext(ctx, sectionId, (section) => {
      const fallback = bodyText ?? "";
      return fallback || section.title || "";
    });

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

  const llm = await resolveLLMModel(ctx, modelConfigId, "throw");
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

export async function* inlineAssistOp(
  ctx: ServiceContext,
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
    await resolveSectionPromptContext(ctx, sectionId, () => input.selectedText);

  let action = input.action;
  let customTemplate: string | undefined;

  if (input.customPromptId) {
    const [promptRecord] = await ctx.db
      .select()
      .from(customPrompts)
      .where(eq(customPrompts.id, input.customPromptId));
    if (promptRecord) {
      action = "template";
      customTemplate = promptRecord.userPrompt;
    }
  }

  const totalVariants = Math.max(1, Math.min(3, input.variantCount ?? 1));
  const llm = await resolveLLMModel(ctx, input.modelConfigId, "throw");

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

  if (totalVariants === 1) {
    for await (const chunk of streamText(llm, buildPrompt(1))) {
      yield { text: chunk, variant: 0 };
    }
    return;
  }

  const streams: AsyncGenerator<{ text: string; variant: number }>[] = [];
  for (let v = 0; v < totalVariants; v++) {
    streams.push(withVariant(streamText(llm, buildPrompt(v + 1)), v));
  }

  yield* mergeAsyncIterables(streams);
}

export async function generateStyleGuideDraftOp(
  ctx: ServiceContext,
  novelId: string,
  modelConfigId?: string | null
): Promise<string> {
  const [novel] = await ctx.db
    .select()
    .from(novels)
    .where(eq(novels.id, novelId));
  assertFound(novel, "Novel not found");

  const context = await searchContext(
    ctx.vectorStore,
    ctx.embedding,
    novelId,
    { query: `${novel.title} ${novel.description ?? ""}` },
    ctx.env
  );

  const prompt = generateStyleGuideDraftPrompt({
    characters: context.characters,
    description: novel.description,
    novelTitle: novel.title,
    settings: context.settings,
  });

  const llm = await resolveLLMModel(ctx, modelConfigId, "throw");
  return generateText(llm, prompt);
}

export async function analyzeSettingImpactOp(
  ctx: ServiceContext,
  novelId: string,
  input: {
    changeTarget: "character" | "setting";
    targetName: string;
    beforeValue: string;
    afterValue: string;
    modelConfigId?: string | null;
  }
) {
  const [novel] = await ctx.db
    .select()
    .from(novels)
    .where(eq(novels.id, novelId));
  assertFound(novel, "Novel not found");

  const structure = await fetchNovelStructureWithContents(ctx.db, [novelId], {
    contentMode: "none",
  });
  const chaptersWithSections = (structure.get(novelId) ?? []).map((node) => ({
    sections: node.sections.map(({ section }) => ({
      summary: section.summary,
      title: section.title ?? `節 ${section.order}`,
    })),
    title: node.chapter.title,
  }));

  const timelineRows = await ctx.db
    .select()
    .from(timelines)
    .where(eq(timelines.novelId, novelId))
    .orderBy(timelines.order);

  const foreshadowingRows = await ctx.db
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

  const llm = await resolveLLMModel(ctx, input.modelConfigId, "throw");
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
