import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

export interface AnalyzeStoryArcContext {
  chapters: Array<{
    id: string;
    title: string;
    sections: Array<{
      id: string;
      title: string;
      summary?: string | null;
      contentSnippet?: string;
    }>;
  }>;
  novelTitle?: string;
}

export function analyzeStoryArcPrompt(context: AnalyzeStoryArcContext): string {
  let structureList = "";
  for (const ch of context.chapters) {
    structureList += `### 章: ${ch.title} (ID: ${ch.id})\n`;
    for (const sec of ch.sections) {
      structureList += `- 節: ${sec.title} (ID: ${sec.id})\n`;
      if (sec.summary) {
        structureList += `  概要: ${sec.summary}\n`;
      }
      if (sec.contentSnippet) {
        structureList += `  本文冒頭/抜粋: ${sec.contentSnippet}\n`;
      }
    }
  }

  const template = getPromptTemplate("analyzeStoryArc");
  return renderPromptTemplate(template.body, {
    novelTitle: context.novelTitle ?? "未設定",
    structureList,
  });
}
