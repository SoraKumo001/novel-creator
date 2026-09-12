import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 人物情報を LLM で編集するプロンプト。
 */
export function editCharacter(
  character: {
    category?: string;
    name: string;
    description?: string;
    traits?: string[];
  },
  instruction: string
): string {
  const category = character.category ?? "未分類";
  const description = character.description ?? "（未設定）";
  const traits = character.traits?.length
    ? character.traits.map((t) => `- ${t}`).join("\n")
    : "（未設定）";

  const template = getPromptTemplate("editCharacter");
  return renderPromptTemplate(template.body, {
    category,
    description,
    instruction,
    name: character.name,
    traits,
  });
}
