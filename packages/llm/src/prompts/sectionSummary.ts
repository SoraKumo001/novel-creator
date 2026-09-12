import { renderPromptTemplate } from "../templateEngine.js";
import { truncateHead } from "../truncate.js";
import { getPromptTemplate } from "./loader.js";

export interface SectionSummaryGrounding {
  /** 対象節の本文抜粋（先頭優先・最大6000字想定。呼び出し側で切り詰め済みでもよい）。 */
  bodyExcerpt?: string;
  /** 同章の前節概要（最大2件想定）。 */
  previousSummaries?: string[];
}

/**
 * 節（セクション）の概要を生成するプロンプト。
 * 第3引数 grounding はオプショナル（既存シグネチャ破壊なし）。
 */
export function sectionSummary(
  chapter: { title: string; summary: string },
  section: { title?: string; order: number },
  grounding?: SectionSummaryGrounding
): string {
  const sectionTitle = section.title ?? "（未設定）";
  const template = getPromptTemplate("sectionSummary");
  const base = renderPromptTemplate(template.body, {
    chapterSummary: chapter.summary,
    chapterTitle: chapter.title,
    sectionOrder: section.order,
    sectionTitle,
  });
  if (!grounding) {
    return base;
  }
  const blocks: string[] = [];
  if (grounding.bodyExcerpt?.trim()) {
    blocks.push(
      `# 対象節の本文抜粋（要約対象・先頭優先）\n${truncateHead(grounding.bodyExcerpt, 6000)}`
    );
  }
  const prevs = (grounding.previousSummaries ?? [])
    .filter((s) => s.trim())
    .slice(0, 2);
  if (prevs.length > 0) {
    blocks.push(
      `# 同章の前節概要（文脈参考）\n${prevs.map((s) => `- ${s.trim()}`).join("\n")}`
    );
  }
  if (blocks.length === 0) {
    return base;
  }
  return `${base}\n\n${blocks.join("\n\n")}\n`;
}
