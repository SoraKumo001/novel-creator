import { chapters, novels, sections } from "@novel-creator/db";
import { eq } from "drizzle-orm";
import { searchContext } from "../../rag.js";
import { assertFound, type ServiceContext } from "../types.js";

/**
 * resolveSectionContext の戻り値。プロンプト組立に必要な行と、RAG 検索結果を
 * プロンプトにそのまま渡せる形（改行連結済み文字列）にしたもの。
 */
export interface SectionPromptContext {
  chapter: typeof chapters.$inferSelect | null;
  characters: string;
  novel: typeof novels.$inferSelect | null;
  section: typeof sections.$inferSelect;
  settings: string;
}

/**
 * proofreadContent / inlineAssist 共通のコンテキスト解決。
 * 節を取得して章・小説をたどり、小説が判明すれば RAG で関連キャラクター・設定を検索する。
 */
export async function resolveSectionPromptContext(
  ctx: ServiceContext,
  sectionId: string,
  buildRagQuery: (section: typeof sections.$inferSelect) => string
): Promise<SectionPromptContext> {
  const [section] = await ctx.db
    .select()
    .from(sections)
    .where(eq(sections.id, sectionId));
  assertFound(section, "Section not found");

  const [chapter] = await ctx.db
    .select()
    .from(chapters)
    .where(eq(chapters.id, section.chapterId));
  const [novel] = chapter
    ? await ctx.db.select().from(novels).where(eq(novels.id, chapter.novelId))
    : [null];

  const context = novel
    ? await searchContext(
        ctx.vectorStore,
        ctx.embedding,
        novel.id,
        { query: buildRagQuery(section) },
        ctx.env
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

/**
 * ストリームの各チャンクにバリアント番号をタグ付けする。
 */
export async function* withVariant(
  stream: AsyncIterable<string>,
  variant: number
): AsyncGenerator<{ text: string; variant: number }> {
  for await (const chunk of stream) {
    yield { text: chunk, variant };
  }
}
