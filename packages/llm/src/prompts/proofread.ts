import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

export interface ProofreadContext {
  body: string;
  chapterTitle?: string;
  characters?: string;
  novelTitle?: string;
  sectionSummary?: string;
  sectionTitle?: string;
  settings?: string;
  styleGuide?: string;
}

export function proofreadPrompt(context: ProofreadContext): string {
  let contextSections = "";

  if (context.novelTitle) {
    contextSections += `■ 作品タイトル: ${context.novelTitle}\n`;
  }
  if (context.chapterTitle) {
    contextSections += `■ 章タイトル: ${context.chapterTitle}\n`;
  }
  if (context.sectionTitle) {
    contextSections += `■ 節タイトル: ${context.sectionTitle}\n`;
  }
  if (context.sectionSummary) {
    contextSections += `■ 節のあらすじ: ${context.sectionSummary}\n`;
  }
  if (context.styleGuide) {
    contextSections += `■ 作品の執筆スタイル・文体ガイドライン:\n${context.styleGuide}\n\n`;
  }
  if (context.characters) {
    contextSections += `■ 関連キャラクター情報:\n${context.characters}\n\n`;
  }
  if (context.settings) {
    contextSections += `■ 関連設定・世界観:\n${context.settings}\n\n`;
  }

  const template = getPromptTemplate("proofread");
  return renderPromptTemplate(template.body, {
    body: context.body,
    contextSections,
  });
}
