import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 小説情報（タイトル・あらすじ・登場人物・設定）から
 * 執筆スタイル・文体ガイドラインのドラフトを自動生成するプロンプト。
 */

export interface GenerateStyleGuideDraftContext {
  characters?: string[];
  description?: string | null;
  novelTitle: string;
  settings?: string[];
}

export function generateStyleGuideDraftPrompt(
  context: GenerateStyleGuideDraftContext
): string {
  const characters = context.characters?.length
    ? context.characters.map((c) => `- ${c}`).join("\n")
    : "（登録なし）";
  const settings = context.settings?.length
    ? context.settings.map((s) => `- ${s}`).join("\n")
    : "（登録なし）";

  const template = getPromptTemplate("generateStyleGuideDraft");
  return renderPromptTemplate(template.body, {
    characters,
    description: context.description || "（未設定）",
    novelTitle: context.novelTitle,
    settings,
  });
}
