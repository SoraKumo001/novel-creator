import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 伏線のドラフトを LLM で生成・反復修正するプロンプト。
 */
export function createForeshadowingDraft(
  instruction: string,
  currentDraft?: {
    category?: string;
    title: string;
    description?: string;
    status?: string;
  }
): string {
  if (!currentDraft) {
    const template = getPromptTemplate("createForeshadowingDraft");
    return renderPromptTemplate(template.body, {
      instruction,
    });
  }

  const category = currentDraft.category ?? "未分類";
  const description = currentDraft.description ?? "（未設定）";
  const status = currentDraft.status ?? "unresolved";

  const template = getPromptTemplate("createForeshadowingDraftModify");
  return renderPromptTemplate(template.body, {
    category,
    description,
    instruction,
    status,
    title: currentDraft.title,
  });
}
