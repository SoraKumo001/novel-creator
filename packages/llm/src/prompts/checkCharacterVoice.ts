import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

export interface CheckCharacterVoiceContext {
  body: string;
  characters: Array<{
    name: string;
    category?: string | null;
    firstPerson?: string | null; // 一人称
    secondPerson?: string | null; // 二人称
    speechPattern?: string | null; // 口調・語尾
    description?: string | null;
  }>;
  novelTitle?: string;
}

export function checkCharacterVoicePrompt(
  context: CheckCharacterVoiceContext
): string {
  let characterList = "";
  for (const char of context.characters) {
    characterList += `- **${char.name}**`;
    if (char.category) {
      characterList += ` (${char.category})`;
    }
    characterList += "\n";
    if (char.firstPerson) {
      characterList += `  - 一人称: ${char.firstPerson}\n`;
    }
    if (char.secondPerson) {
      characterList += `  - 二人称: ${char.secondPerson}\n`;
    }
    if (char.speechPattern) {
      characterList += `  - 口調・特徴: ${char.speechPattern}\n`;
    }
    if (char.description) {
      characterList += `  - 詳細設定: ${char.description}\n`;
    }
  }

  const template = getPromptTemplate("checkCharacterVoice");
  return renderPromptTemplate(template.body, {
    body: context.body,
    characterList,
  });
}
