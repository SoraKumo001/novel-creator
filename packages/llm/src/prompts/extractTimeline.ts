import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 本文から時系列情報を抽出するプロンプト。JSON 配列を返すよう指示する。
 */
export function extractTimeline(content: string): string {
  const template = getPromptTemplate("extractTimeline");
  return renderPromptTemplate(template.body, {
    content,
  });
}
