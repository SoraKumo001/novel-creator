import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 伏線マークダウン文書全体を LLM で編集するプロンプト。
 * 出力は編集後のマークダウン文書全体。
 */
export function editForeshadowingDocument(
  document: string,
  instruction: string,
  context?: { settings: string[]; characters: string[]; plot?: string[] }
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
  if (context?.plot && context.plot.length > 0) {
    contextLines.push("## プロット・あらすじ");
    contextLines.push(...context.plot.map((p) => `- ${p}`));
  }
  const contextBlock =
    contextLines.length > 0 ? contextLines.join("\n") : "（なし）";

  const template = getPromptTemplate("editForeshadowingDocument");
  return renderPromptTemplate(template.body, {
    contextBlock,
    document,
    instruction,
  });
}
