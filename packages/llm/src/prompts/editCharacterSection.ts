import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 人物マークダウンの単一セクションを LLM で編集するプロンプト。
 * 出力はプレーンなマークダウン本文（`##` 見出し行を含まない）。
 */
export function editCharacterSection(
  section: {
    category: string;
    name: string;
    description: string;
    traits: string[];
    relationships: string;
  },
  instruction: string,
  context?: { settings: string[]; characters: string[] }
): string {
  const description = section.description.trim() || "（未設定）";
  const traits = section.traits.length
    ? section.traits.map((t) => `- ${t}`).join("\n")
    : "（未設定）";
  const relationships = section.relationships.trim() || "（未設定）";

  const contextLines: string[] = [];
  if (context?.settings && context.settings.length > 0) {
    contextLines.push("## 関連する設定");
    contextLines.push(...context.settings.map((s) => `- ${s}`));
  }
  if (context?.characters && context.characters.length > 0) {
    contextLines.push("## 関連する人物");
    contextLines.push(...context.characters.map((c) => `- ${c}`));
  }
  const contextBlock =
    contextLines.length > 0 ? contextLines.join("\n") : "（なし）";

  const template = getPromptTemplate("editCharacterSection");
  return renderPromptTemplate(template.body, {
    category: section.category,
    contextBlock,
    description,
    instruction,
    name: section.name,
    relationships,
    traits,
  });
}
