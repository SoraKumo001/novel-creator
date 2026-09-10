import {
  analysisResults,
  chapters,
  characters,
  contents,
  novels,
  sections,
} from "@novel-creator/db";
import {
  analyzeStoryArcPrompt,
  checkCharacterVoicePrompt,
  generateJSON,
  multiPersonaReviewPrompt,
  type ReaderPersonaType,
} from "@novel-creator/llm";
import { eq } from "drizzle-orm";
import {
  buildOpenCodeSessionHeaders,
  resolveLLMModelWithInfo,
} from "../model-resolver.js";
import { fetchNovelStructureWithContents } from "../novel-structure.js";
import { assertFound, type ServiceContext } from "../types.js";
import { assembleWholeNovelBody } from "./analysis-body.js";
import { runWithHeartbeat } from "./analysis-heartbeat.js";
import type {
  AnalysisStreamEvent,
  PersonaReviewInput,
} from "./analysis-types.js";

export async function* streamStoryArcOp(
  ctx: ServiceContext,
  novelId: string,
  modelConfigId?: string | null
): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
  const [novel] = await ctx.db
    .select()
    .from(novels)
    .where(eq(novels.id, novelId));
  assertFound(novel, "Novel not found");

  // プロンプトには節本文の先頭 300 文字スニペットのみ使うため、
  // DB 側で切り詰めたスニペット取得にして全文の過剰フェッチを避ける。
  const structure = await fetchNovelStructureWithContents(ctx.db, [novelId], {
    contentMode: "snippet",
    snippetLength: 300,
  });
  const chapterNodes = structure.get(novelId) ?? [];

  const chaptersWithSections: Array<{
    id: string;
    sections: Array<{
      contentSnippet?: string;
      id: string;
      summary: string | null;
      title: string;
    }>;
    title: string;
  }> = [];
  let sectionCount = 0;
  let current = 0;

  for (const node of chapterNodes) {
    const sectionsData = node.sections.map(({ section, body }) => ({
      contentSnippet: body || undefined,
      id: section.id,
      summary: section.summary,
      title: section.title ?? `節 ${section.order}`,
    }));

    sectionCount += sectionsData.length;
    chaptersWithSections.push({
      id: node.chapter.id,
      sections: sectionsData,
      title: node.chapter.title,
    });

    current += 1;
    yield {
      current,
      stage: "章・節の本文を収集中",
      total: chapterNodes.length,
      type: "progress",
    };
  }

  if (chapterNodes.length === 0 || sectionCount === 0) {
    throw new Error("章・節が登録されていないため分析できません");
  }

  const prompt = analyzeStoryArcPrompt({
    chapters: chaptersWithSections,
    novelTitle: novel.title,
  });

  const resolved = await resolveLLMModelWithInfo(ctx, modelConfigId, "throw");
  const headers = buildOpenCodeSessionHeaders(
    resolved,
    novelId,
    ctx.env.LLM_BASE_URL
  );
  const llmPromise = generateJSON<{
    dataPoints: Array<{
      advice: string;
      chapterId: string;
      chapterTitle: string;
      keyEvent: string;
      pacing: number;
      sectionId: string;
      sectionTitle: string;
      tension: number;
      valence: number;
    }>;
    pacingCritique: string;
    summary: string;
  }>(resolved.model, prompt, undefined, {
    ...(headers ? { headers } : {}),
  });
  const result = yield* runWithHeartbeat(llmPromise);

  yield { current: 0, stage: "分析結果を保存中", total: 0, type: "progress" };
  const [row] = await ctx.db
    .insert(analysisResults)
    .values({ analysisType: "story-arc", novelId, result })
    .returning();

  yield { result, savedId: row.id, type: "complete" };
}

export async function* streamCheckVoiceOp(
  ctx: ServiceContext,
  novelId: string,
  sectionId?: string,
  customBody?: string,
  modelConfigId?: string | null
): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
  const [novel] = await ctx.db
    .select()
    .from(novels)
    .where(eq(novels.id, novelId));
  assertFound(novel, "Novel not found");

  const characterRows = await ctx.db
    .select()
    .from(characters)
    .where(eq(characters.novelId, novelId));

  let bodyText = customBody;
  if (bodyText === undefined && sectionId) {
    const [content] = await ctx.db
      .select()
      .from(contents)
      .where(eq(contents.sectionId, sectionId));
    bodyText = content?.body ?? "";
  }
  if (!bodyText) {
    // 本文指定・節指定が双方ない場合は小説全体を対象にする。
    bodyText = await assembleWholeNovelBody(ctx, novelId);
  }
  if (!bodyText.trim()) {
    throw new Error("分析対象の本文が空です。執筆後に実行してください");
  }

  const charactersFormatted = characterRows.map((char) => {
    let firstPerson: string | null = null;
    let secondPerson: string | null = null;
    let speechPattern: string | null = null;

    if (Array.isArray(char.traits)) {
      for (const trait of char.traits as string[]) {
        if (trait.includes("一人称")) {
          firstPerson = trait;
        } else if (trait.includes("二人称")) {
          secondPerson = trait;
        } else if (trait.includes("口調") || trait.includes("語尾")) {
          speechPattern = trait;
        }
      }
    }

    return {
      category: char.category,
      description: char.description,
      firstPerson,
      name: char.name,
      secondPerson,
      speechPattern,
    };
  });

  const prompt = checkCharacterVoicePrompt({
    body: bodyText,
    characters: charactersFormatted,
    novelTitle: novel.title,
  });

  const resolved = await resolveLLMModelWithInfo(ctx, modelConfigId, "throw");
  const headers = buildOpenCodeSessionHeaders(
    resolved,
    novelId,
    ctx.env.LLM_BASE_URL
  );
  const llmPromise = generateJSON<{
    issues: Array<{
      characterName: string;
      dialogue: string;
      issueType:
        | "firstPerson"
        | "secondPerson"
        | "speechPattern"
        | "toneShift"
        | "outOfCharacter";
      reason: string;
      suggestion: string;
    }>;
    summary: string;
  }>(resolved.model, prompt, undefined, {
    ...(headers ? { headers } : {}),
  });
  const result = yield* runWithHeartbeat(llmPromise);

  yield { current: 0, stage: "分析結果を保存中", total: 0, type: "progress" };
  const [row] = await ctx.db
    .insert(analysisResults)
    .values({
      analysisType: "check-voice",
      novelId,
      result,
      targetSectionId: sectionId ?? null,
    })
    .returning();

  yield { result, savedId: row.id, type: "complete" };
}

export async function* streamPersonaReviewOp(
  ctx: ServiceContext,
  novelId: string,
  input: PersonaReviewInput
): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
  const [novel] = await ctx.db
    .select()
    .from(novels)
    .where(eq(novels.id, novelId));
  assertFound(novel, "Novel not found");

  let bodyText = input.customBody ?? "";
  let chapterTitle: string | undefined;
  let sectionTitle: string | undefined;

  if (input.sectionId) {
    const [sec] = await ctx.db
      .select()
      .from(sections)
      .where(eq(sections.id, input.sectionId));
    if (sec) {
      sectionTitle = sec.title ?? `節 ${sec.order}`;
      if (!bodyText) {
        const [content] = await ctx.db
          .select()
          .from(contents)
          .where(eq(contents.sectionId, sec.id));
        bodyText = content?.body ?? "";
      }
      const [ch] = await ctx.db
        .select()
        .from(chapters)
        .where(eq(chapters.id, sec.chapterId));
      if (ch) {
        chapterTitle = ch.title;
      }
    }
  } else if (input.chapterId) {
    const [ch] = await ctx.db
      .select()
      .from(chapters)
      .where(eq(chapters.id, input.chapterId));
    if (ch) {
      chapterTitle = ch.title;
      if (!bodyText) {
        // 章内の節本文をヘルパでバルク取得（従来の節ごとの個別 SELECT を解消）
        const structure = await fetchNovelStructureWithContents(ctx.db, [
          ch.novelId,
        ]);
        const chapterNode = (structure.get(ch.novelId) ?? []).find(
          (candidate) => candidate.chapter.id === ch.id
        );
        const bodies: string[] = [];
        if (chapterNode) {
          for (const { section, body } of chapterNode.sections) {
            if (body) {
              bodies.push(
                `【${section.title ?? `節 ${section.order}`}】\n${body}`
              );
            }
          }
        }
        bodyText = bodies.join("\n\n");
      }
    }
  } else if (!bodyText) {
    // 節・章・本文のいずれも指定がない場合は小説全体を対象にする。
    bodyText = await assembleWholeNovelBody(ctx, novelId);
  }

  if (!bodyText.trim()) {
    throw new Error("分析対象の本文が空です。執筆後に実行してください");
  }

  const prompt = multiPersonaReviewPrompt({
    chapterTitle,
    novelTitle: novel.title,
    sectionTitle,
    text: bodyText,
  });

  const resolved = await resolveLLMModelWithInfo(
    ctx,
    input.modelConfigId,
    "throw"
  );
  const headers = buildOpenCodeSessionHeaders(
    resolved,
    novelId,
    ctx.env.LLM_BASE_URL
  );
  const llmPromise = generateJSON<{
    overallImpression: string;
    reviews: Array<{
      advice: string;
      catchphrase: string;
      criticism: string;
      persona: ReaderPersonaType;
      personaName: string;
      praise: string;
      rating: number;
    }>;
  }>(resolved.model, prompt, undefined, {
    ...(headers ? { headers } : {}),
  });
  const result = yield* runWithHeartbeat(llmPromise);

  yield { current: 0, stage: "分析結果を保存中", total: 0, type: "progress" };
  const [row] = await ctx.db
    .insert(analysisResults)
    .values({
      analysisType: "persona-review",
      novelId,
      result,
      targetChapterId: input.chapterId ?? null,
      targetSectionId: input.sectionId ?? null,
    })
    .returning();

  yield { result, savedId: row.id, type: "complete" };
}
