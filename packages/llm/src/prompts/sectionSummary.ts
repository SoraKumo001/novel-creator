import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 節（セクション）の概要を生成するプロンプト。
 */
export function sectionSummary(
  chapter: { title: string; summary: string },
  section: { title?: string; order: number }
): string {
  const sectionTitle = section.title ?? "（未設定）";

  const template = getPromptTemplate("sectionSummary");
  return renderPromptTemplate(template.body, {
    chapterSummary: chapter.summary,
    chapterTitle: chapter.title,
    sectionOrder: section.order,
    sectionTitle,
  });
}
