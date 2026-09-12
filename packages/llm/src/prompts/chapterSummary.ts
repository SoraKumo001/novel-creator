import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

export interface ChapterSummaryGrounding {
  /** 当該章の全節概要（箇条書き注入用。本文は含めない）。 */
  sectionSummaries?: string[];
}

/**
 * 個別の章の詳細な概要を生成するプロンプト。
 * 第3引数 grounding はオプショナル（既存シグネチャ破壊なし）。
 */
export function chapterSummary(
  novel: { title: string; description: string },
  chapter: { title: string; order: number; summary?: string },
  grounding?: ChapterSummaryGrounding
): string {
  const existingSummary = chapter.summary ?? "（未設定）";

  const template = getPromptTemplate("chapterSummary");
  const base = renderPromptTemplate(template.body, {
    chapterOrder: chapter.order,
    chapterTitle: chapter.title,
    description: novel.description,
    existingSummary,
    title: novel.title,
  });
  const items = (grounding?.sectionSummaries ?? []).filter((s) => s.trim());
  if (items.length === 0) {
    return base;
  }
  return `${base}\n\n# 当該章の節概要一覧（要約対象・本文は含まない）\n${items.map((s) => `- ${s.trim()}`).join("\n")}\n`;
}
