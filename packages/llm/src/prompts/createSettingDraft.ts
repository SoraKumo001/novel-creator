import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 設定のドラフトを LLM で生成・反復修正するプロンプト。
 */
export function createSettingDraft(
  instruction: string,
  currentDraft?: { category: string; name: string; description?: string }
): string {
  if (!currentDraft) {
    const template = getPromptTemplate("createSettingDraft");
    return renderPromptTemplate(template.body, {
      instruction,
    });
  }

  const description = currentDraft.description ?? "（未設定）";
  const template = getPromptTemplate("createSettingDraftModify");
  return renderPromptTemplate(template.body, {
    category: currentDraft.category,
    description,
    instruction,
    name: currentDraft.name,
  });
}
