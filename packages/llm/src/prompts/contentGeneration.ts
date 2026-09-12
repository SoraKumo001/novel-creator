import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 本文を生成するプロンプト。前の文脈、章情報、登場人物、設定を考慮する。
 */
export function contentGeneration(
  section: { title?: string; summary: string },
  context: {
    chapter?: { summary?: string | null; title?: string };
    characters?: string[];
    previousContent?: string;
    settings?: string[];
    styleGuide?: string | null;
  }
): string {
  const sectionTitle = section.title ?? "（未設定）";
  const previousContent = context.previousContent
    ? context.previousContent
    : "（前の文脈なし）";
  const characters = context.characters?.length
    ? context.characters.map((c) => `- ${c}`).join("\n")
    : "（指定なし）";
  const settings = context.settings?.length
    ? context.settings.map((s) => `- ${s}`).join("\n")
    : "（指定なし）";
  const styleGuideSection = context.styleGuide?.trim()
    ? `\n# 執筆スタイル・文体ガイドライン\n${context.styleGuide.trim()}\n`
    : "";

  const chapterSection = context.chapter
    ? `# 章情報\n- 章タイトル: ${context.chapter.title ?? "（未設定）"}${
        context.chapter.summary?.trim()
          ? `\n- 章の概要: ${context.chapter.summary.trim()}`
          : ""
      }\n\n`
    : "";

  const styleGuideInstruction = context.styleGuide?.trim()
    ? "上記の「執筆スタイル・文体ガイドライン」（視点、人称、文体トーン、作法、禁止事項等）を最優先で厳格に遵守してください。"
    : "地の文・会話・心理描写をバランスよく織り交ぜてください。";

  const template = getPromptTemplate("contentGeneration");
  return renderPromptTemplate(template.body, {
    chapterSection,
    characters,
    previousContent,
    sectionSummary: section.summary,
    sectionTitle,
    settings,
    styleGuideInstruction,
    styleGuideSection,
  });
}
