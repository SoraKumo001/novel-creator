import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 本文から設定情報を抽出・更新するプロンプト。JSON 配列を返すよう指示する。
 */
export function extractSettings(
  content: string,
  existingSettings?: string[]
): string {
  const existing = existingSettings?.length
    ? existingSettings.map((s) => `- ${s}`).join("\n")
    : "（既存の設定なし）";

  const template = getPromptTemplate("extractSettings");
  return renderPromptTemplate(template.body, {
    content,
    existingSettings: existing,
  });
}
