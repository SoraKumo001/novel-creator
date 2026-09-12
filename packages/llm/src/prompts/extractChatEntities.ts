import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * チャットテキストから登場人物、世界観設定、伏線、年表、プロットを抽出・構造化するプロンプト。
 */
export function extractChatEntities(text: string): string {
  const template = getPromptTemplate("extractChatEntities");
  return renderPromptTemplate(template.body, {
    text,
  });
}
