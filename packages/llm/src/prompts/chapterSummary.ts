import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 個別の章の詳細な概要を生成するプロンプト。
 */
export function chapterSummary(
  novel: { title: string; description: string },
  chapter: { title: string; order: number; summary?: string }
): string {
  const existingSummary = chapter.summary ?? "（未設定）";

  const template = getPromptTemplate("chapterSummary");
  return renderPromptTemplate(template.body, {
    chapterOrder: chapter.order,
    chapterTitle: chapter.title,
    description: novel.description,
    existingSummary,
    title: novel.title,
  });
}
