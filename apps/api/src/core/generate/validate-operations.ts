import {
  chapters,
  contents,
  glossaryEntries,
  sections,
} from "@novel-creator/db";
import { generateJSON } from "@novel-creator/llm";
import { eq } from "drizzle-orm";
import { assertFound, type ServiceContext } from "../types.js";

export interface GlossaryViolation {
  excerpt: string;
  kind: string;
  suggestion: string;
  term: string;
}

export interface SectionGlossaryValidation {
  ok: boolean;
  violations: GlossaryViolation[];
}

/**
 * 節本文と用語集の整合性を検証する（読取のみ・DB書込なし・SSEに混ぜない）。
 * 用語0件なら即ok。ルール事前絞込で候補を減らし、残候補のみLLM判定1回。
 * LLM失敗時はcatchして空配列（検証スキップ扱い）。
 */
export async function validateSectionGlossaryOp(
  ctx: ServiceContext,
  sectionId: string
): Promise<SectionGlossaryValidation> {
  const [section] = await ctx.db
    .select()
    .from(sections)
    .where(eq(sections.id, sectionId));
  assertFound(section, "Section not found");
  const [chapter] = await ctx.db
    .select()
    .from(chapters)
    .where(eq(chapters.id, section.chapterId));
  assertFound(chapter, "Chapter not found");

  const [content] = await ctx.db
    .select()
    .from(contents)
    .where(eq(contents.sectionId, sectionId));
  const body = content?.body?.trim() ?? "";
  if (!body) {
    return { ok: true, violations: [] };
  }

  const entries = await ctx.db
    .select()
    .from(glossaryEntries)
    .where(eq(glossaryEntries.novelId, chapter.novelId));
  if (entries.length === 0) {
    return { ok: true, violations: [] };
  }

  const lowered = body.toLowerCase();
  const candidates = entries.filter((e) => {
    const names = [
      e.term,
      ...((e.aliases as string[] | null | undefined) ?? []),
    ].filter((n) => n?.trim());
    return names.some((n) => lowered.includes(n.toLowerCase()));
  });
  if (candidates.length === 0) {
    return { ok: true, violations: [] };
  }

  const glossaryList = candidates
    .slice(0, 20)
    .map((e) => {
      const aliases = ((e.aliases as string[] | null | undefined) ?? []).join(
        "、"
      );
      return `- 用語: ${e.term}${e.reading ? `（${e.reading}）` : ""}${e.description ? ` / ${e.description}` : ""}${aliases ? ` / 別名: ${aliases}` : ""}`;
    })
    .join("\n");
  const excerpt = body.slice(0, 4000);
  const prompt = `あなたは小説の用語監修者です。以下の本文抜粋における用語集の表記ゆれ・誤用を指摘してください。

# 用語集（本文中に出現した候補のみ）
${glossaryList}

# 本文抜粋
${excerpt}

# 指示
1. 用語・別名・読みの表記ゆれ、定義と矛盾する用法のみを指摘する。
2. 指摘がない場合は空配列を返す。
3. 次のJSON配列のみを出力する（他のテキスト禁止）:
[{"term": "用語", "kind": "表記ゆれ|誤用", "excerpt": "該当箇所の短い引用", "suggestion": "修正提案"}]`;

  let violations: GlossaryViolation[] = [];
  try {
    const result = await generateJSON<GlossaryViolation[]>(ctx.llm, prompt);
    violations = Array.isArray(result) ? result : [];
  } catch {
    violations = [];
  }

  return { ok: violations.length === 0, violations };
}
