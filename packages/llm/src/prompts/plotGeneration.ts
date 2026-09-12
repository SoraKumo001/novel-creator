import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 小説の全体プロットと章立てを生成するプロンプト。
 */
export function plotGeneration(novel: {
  title: string;
  description: string;
  settings?: string[];
  characters?: string[];
}): string {
  const settings = novel.settings?.length
    ? novel.settings.map((s) => `- ${s}`).join("\n")
    : "（指定なし）";
  const characters = novel.characters?.length
    ? novel.characters.map((c) => `- ${c}`).join("\n")
    : "（指定なし）";

  const template = getPromptTemplate("plotGeneration");
  return renderPromptTemplate(template.body, {
    characters,
    description: novel.description,
    settings,
    title: novel.title,
  });
}
