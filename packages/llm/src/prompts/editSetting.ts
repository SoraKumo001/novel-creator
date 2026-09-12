import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 設定情報を LLM で編集するプロンプト。
 */
export function editSetting(
  setting: { category: string; name: string; description?: string },
  instruction: string
): string {
  const description = setting.description ?? "（未設定）";
  const template = getPromptTemplate("editSetting");
  return renderPromptTemplate(template.body, {
    category: setting.category,
    description,
    instruction,
    name: setting.name,
  });
}
