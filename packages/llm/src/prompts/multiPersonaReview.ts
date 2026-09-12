import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

export type ReaderPersonaType =
  | "editor" // 商業文芸・ラノベ編集者（構成・引き・商業性重視）
  | "casual" // 一般エンタメ読者（面白さ・感情移入・爽快感重視）
  | "lore" // 世界観・考察派読者（設定の緻密さ・伏線重視）
  | "critic"; // 辛口文学評論家（文体・テーマ性・心理描写重視）

export interface MultiPersonaReviewContext {
  chapterTitle?: string;
  genre?: string;
  novelTitle?: string;
  sectionTitle?: string;
  targetAudience?: string;
  text: string;
}

export function multiPersonaReviewPrompt(
  context: MultiPersonaReviewContext
): string {
  let contextMeta = "";

  if (context.genre) {
    contextMeta += `- ジャンル: ${context.genre}\n`;
  }
  if (context.targetAudience) {
    contextMeta += `- ターゲット層: ${context.targetAudience}\n`;
  }
  if (context.chapterTitle) {
    contextMeta += `- 対象章: ${context.chapterTitle}\n`;
  }
  if (context.sectionTitle) {
    contextMeta += `- 対象節: ${context.sectionTitle}\n`;
  }

  const template = getPromptTemplate("multiPersonaReview");
  return renderPromptTemplate(template.body, {
    contextMeta,
    novelTitle: context.novelTitle ?? "未設定",
    text: context.text,
  });
}
