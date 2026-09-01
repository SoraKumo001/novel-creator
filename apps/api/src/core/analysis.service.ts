import { and, desc, eq } from 'drizzle-orm';
import {
  analysisResults,
  chapters,
  characters,
  contents,
  novels,
  sections,
} from '@novel-creator/db';
import {
  analyzeStoryArcPrompt,
  checkCharacterVoicePrompt,
  generateJSON,
  multiPersonaReviewPrompt,
  type ReaderPersonaType,
} from '@novel-creator/llm';
import { resolveLLMModel } from './model-resolver.js';
import { fetchNovelStructureWithContents } from './novel-structure.js';
import { assertFound, type ServiceContext } from './types.js';

export type AnalysisStreamEvent =
  | { type: 'progress'; stage: string; current: number; total: number }
  | { type: 'complete'; result: unknown; savedId: string }
  | { type: 'error'; message: string };

/** LLM 応答待ち中にハートビート進行イベントを流す間隔（ミリ秒）。 */
const HEARTBEAT_INTERVAL_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AnalysisDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  /**
   * LLM 呼び出しをハートビートで包む。
   * Promise.race により LLM 応答待ちの間も 10 秒ごとに
   * 不定長の progress イベントを送り、SSE 接続がアイドルにならないようにする。
   * LLM promise の rejection はそのまま呼び出し元へ伝播する。
   */
  private async *runWithHeartbeat<T>(
    llmPromise: Promise<T>,
  ): AsyncGenerator<AnalysisStreamEvent, T, undefined> {
    type RaceOutcome<R> = { beat: true } | { beat: false; value: R };

    // 消費されない rejection による unhandled rejection を防止する。
    llmPromise.catch(() => {});

    const settled: Promise<RaceOutcome<T>> = llmPromise.then((value): RaceOutcome<T> => ({
      beat: false,
      value,
    }));
    const beat: Promise<RaceOutcome<T>> = sleep(HEARTBEAT_INTERVAL_MS).then((): RaceOutcome<T> => ({
      beat: true,
    }));

    let outcome = await Promise.race([settled, beat]);
    while (outcome.beat) {
      yield { type: 'progress', stage: 'AIが分析中', current: 0, total: 0 };
      outcome = await Promise.race([settled, beat]);
    }

    return outcome.value;
  }

  /**
   * 小説全体の本文を章→節の順に結合して返す。
   * 各節の本文には「【章タイトル / 節タイトル】」のヘッダーを付ける。
   * 章・節・本文は共通ヘルパでバルク取得する（N+1 解消）。
   */
  private async assembleWholeNovelBody(novelId: string): Promise<string> {
    const structure = await fetchNovelStructureWithContents(this.ctx.db, [novelId]);

    const parts: string[] = [];
    for (const { chapter, sections: sectionNodes } of structure.get(novelId) ?? []) {
      for (const { section, body } of sectionNodes) {
        if (body) {
          parts.push(`【${chapter.title} / ${section.title ?? `節 ${section.order}`}】\n${body}`);
        }
      }
    }

    return parts.join('\n\n');
  }

  async *streamStoryArc(
    novelId: string,
    modelConfigId?: string | null,
  ): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, novelId));
    assertFound(novel, 'Novel not found');

    // プロンプトには節本文の先頭 300 文字スニペットのみ使うため、
    // DB 側で切り詰めたスニペット取得にして全文の過剰フェッチを避ける。
    const structure = await fetchNovelStructureWithContents(this.ctx.db, [novelId], {
      contentMode: 'snippet',
      snippetLength: 300,
    });
    const chapterNodes = structure.get(novelId) ?? [];

    const chaptersWithSections: Array<{
      id: string;
      title: string;
      sections: Array<{
        id: string;
        title: string;
        summary: string | null;
        contentSnippet?: string;
      }>;
    }> = [];
    let sectionCount = 0;
    let current = 0;

    for (const node of chapterNodes) {
      const sectionsData = node.sections.map(({ section, body }) => ({
        id: section.id,
        title: section.title ?? `節 ${section.order}`,
        summary: section.summary,
        contentSnippet: body || undefined,
      }));

      sectionCount += sectionsData.length;
      chaptersWithSections.push({
        id: node.chapter.id,
        title: node.chapter.title,
        sections: sectionsData,
      });

      current += 1;
      yield {
        type: 'progress',
        stage: '章・節の本文を収集中',
        current,
        total: chapterNodes.length,
      };
    }

    if (chapterNodes.length === 0 || sectionCount === 0) {
      throw new Error('章・節が登録されていないため分析できません');
    }

    const prompt = analyzeStoryArcPrompt({
      novelTitle: novel.title,
      chapters: chaptersWithSections,
    });

    const llm = await resolveLLMModel(this.ctx, modelConfigId, 'throw');
    const llmPromise = generateJSON<{
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
    const result = yield* this.runWithHeartbeat(llmPromise);

    yield { type: 'progress', stage: '分析結果を保存中', current: 0, total: 0 };
    const [row] = await this.ctx.db
      .insert(analysisResults)
      .values({ novelId, analysisType: 'story-arc', result })
      .returning();

    yield { type: 'complete', result, savedId: row.id };
  }

  async *streamCheckVoice(
    novelId: string,
    sectionId?: string,
    customBody?: string,
    modelConfigId?: string | null,
  ): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
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
    if (!bodyText) {
      // 本文指定・節指定が双方ない場合は小説全体を対象にする。
      bodyText = await this.assembleWholeNovelBody(novelId);
    }
    if (!bodyText.trim()) {
      throw new Error('分析対象の本文が空です。執筆後に実行してください');
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
      body: bodyText,
    });

    const llm = await resolveLLMModel(this.ctx, modelConfigId, 'throw');
    const llmPromise = generateJSON<{
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
    const result = yield* this.runWithHeartbeat(llmPromise);

    yield { type: 'progress', stage: '分析結果を保存中', current: 0, total: 0 };
    const [row] = await this.ctx.db
      .insert(analysisResults)
      .values({
        novelId,
        analysisType: 'check-voice',
        targetSectionId: sectionId ?? null,
        result,
      })
      .returning();

    yield { type: 'complete', result, savedId: row.id };
  }

  async *streamPersonaReview(
    novelId: string,
    input: {
      sectionId?: string;
      chapterId?: string;
      customBody?: string;
      modelConfigId?: string | null;
    },
  ): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
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
          // 章内の節本文をヘルパでバルク取得（従来の節ごとの個別 SELECT を解消）
          const structure = await fetchNovelStructureWithContents(this.ctx.db, [ch.novelId]);
          const chapterNode = (structure.get(ch.novelId) ?? []).find(
            (candidate) => candidate.chapter.id === ch.id,
          );
          const bodies: string[] = [];
          if (chapterNode) {
            for (const { section, body } of chapterNode.sections) {
              if (body) {
                bodies.push(`【${section.title ?? `節 ${section.order}`}】\n${body}`);
              }
            }
          }
          bodyText = bodies.join('\n\n');
        }
      }
    } else if (!bodyText) {
      // 節・章・本文のいずれも指定がない場合は小説全体を対象にする。
      bodyText = await this.assembleWholeNovelBody(novelId);
    }

    if (!bodyText.trim()) {
      throw new Error('分析対象の本文が空です。執筆後に実行してください');
    }

    const prompt = multiPersonaReviewPrompt({
      novelTitle: novel.title,
      chapterTitle,
      sectionTitle,
      text: bodyText,
    });

    const llm = await resolveLLMModel(this.ctx, input.modelConfigId, 'throw');
    const llmPromise = generateJSON<{
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
    const result = yield* this.runWithHeartbeat(llmPromise);

    yield { type: 'progress', stage: '分析結果を保存中', current: 0, total: 0 };
    const [row] = await this.ctx.db
      .insert(analysisResults)
      .values({
        novelId,
        analysisType: 'persona-review',
        targetSectionId: input.sectionId ?? null,
        targetChapterId: input.chapterId ?? null,
        result,
      })
      .returning();

    yield { type: 'complete', result, savedId: row.id };
  }

  async listResults(
    novelId: string,
    analysisType?: 'story-arc' | 'check-voice' | 'persona-review',
  ) {
    const conditions = [eq(analysisResults.novelId, novelId)];
    if (analysisType) {
      conditions.push(eq(analysisResults.analysisType, analysisType));
    }

    const rows = await this.ctx.db
      .select()
      .from(analysisResults)
      .where(and(...conditions))
      .orderBy(desc(analysisResults.createdAt))
      .limit(50);

    return rows.map((row) => ({
      id: row.id,
      novelId: row.novelId,
      analysisType: row.analysisType,
      targetSectionId: row.targetSectionId,
      targetChapterId: row.targetChapterId,
      result: row.result,
      createdAt: row.createdAt?.toISOString() ?? null,
    }));
  }

  async deleteResult(novelId: string, resultId: string) {
    await this.ctx.db
      .delete(analysisResults)
      .where(and(eq(analysisResults.id, resultId), eq(analysisResults.novelId, novelId)));
  }
}
