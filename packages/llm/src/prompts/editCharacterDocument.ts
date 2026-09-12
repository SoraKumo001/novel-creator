import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 人物マークダウン文書全体を LLM で編集するプロンプト。
 * 出力は編集後のマークダウン文書全体。
 */
export function editCharacterDocument(
  document: string,
  instruction: string,
  context?: { settings: string[]; characters: string[] }
): string {
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

  const template = getPromptTemplate("editCharacterDocument");
  return renderPromptTemplate(template.body, {
    contextBlock,
    document,
    instruction,
  });
}
