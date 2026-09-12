import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 伏線マークダウンの単一セクションを LLM で編集するプロンプト。
 * 出力はプレーンなマークダウン本文（`##` 見出し行を含まない）。
 */
export function editForeshadowingSection(
  section: {
    category: string;
    title: string;
    description: string;
    status?: string;
  },
  instruction: string,
  context?: { settings: string[]; characters: string[]; plot?: string[] }
): string {
  const description = section.description.trim() || "（未設定）";
  const status = section.status ?? "unresolved";

  const contextLines: string[] = [];
  if (context?.settings && context.settings.length > 0) {
    contextLines.push("## 関連する設定");
    contextLines.push(...context.settings.map((s) => `- ${s}`));
  }
  if (context?.characters && context.characters.length > 0) {
    contextLines.push("## 関連する人物");
    contextLines.push(...context.characters.map((c) => `- ${c}`));
  }
  if (context?.plot && context.plot.length > 0) {
    contextLines.push("## プロット・あらすじ");
    contextLines.push(...context.plot.map((p) => `- ${p}`));
  }
  const contextBlock =
    contextLines.length > 0 ? contextLines.join("\n") : "（なし）";

  const template = getPromptTemplate("editForeshadowingSection");
  return renderPromptTemplate(template.body, {
    category: section.category,
    contextBlock,
    description,
    instruction,
    status,
    title: section.title,
  });
}
