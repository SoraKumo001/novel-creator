import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * ストーリー構想（あらすじ・今後の展開・結末・メモ等）用の LLM プロンプト群。
 */

/**
 * ストーリー構想マークダウンの特定セクションを編集するプロンプト。
 */
export function editStoryOutlineSection(
  section: {
    category: string;
    name: string;
    content: string;
  },
  instruction: string,
  context?: {
    novelTitle?: string;
    settings?: string[];
    characters?: string[];
    entireOutlinePreview?: string;
  }
): string {
  const content = section.content.trim() || "（未記入）";

  const contextLines: string[] = [];
  if (context?.novelTitle) {
    contextLines.push(`- 作品タイトル: ${context.novelTitle}`);
  }
  if (context?.characters && context.characters.length > 0) {
    contextLines.push("## 登場人物");
    contextLines.push(...context.characters.map((c) => `- ${c}`));
  }
  if (context?.settings && context.settings.length > 0) {
    contextLines.push("## 世界観・設定");
    contextLines.push(...context.settings.map((s) => `- ${s}`));
  }
  if (context?.entireOutlinePreview) {
    contextLines.push("## ストーリー構想全体（文脈参考）");
    contextLines.push(context.entireOutlinePreview);
  }
  const contextBlock =
    contextLines.length > 0 ? contextLines.join("\n") : "（なし）";

  const template = getPromptTemplate("editStoryOutlineSection");
  return renderPromptTemplate(template.body, {
    category: section.category,
    content,
    contextBlock,
    instruction,
    name: section.name,
  });
}

/**
 * ストーリー構想マークダウン全体を編集するプロンプト。
 */
export function editStoryOutlineDocument(
  markdown: string,
  instruction: string,
  context?: {
    novelTitle?: string;
    settings?: string[];
    characters?: string[];
  }
): string {
  const contextLines: string[] = [];
  if (context?.novelTitle) {
    contextLines.push(`- 作品タイトル: ${context.novelTitle}`);
  }
  if (context?.characters && context.characters.length > 0) {
    contextLines.push("## 登場人物");
    contextLines.push(...context.characters.map((c) => `- ${c}`));
  }
  if (context?.settings && context.settings.length > 0) {
    contextLines.push("## 世界観・設定");
    contextLines.push(...context.settings.map((s) => `- ${s}`));
  }
  const contextBlock =
    contextLines.length > 0 ? contextLines.join("\n") : "（なし）";

  const template = getPromptTemplate("editStoryOutlineDocument");
  return renderPromptTemplate(template.body, {
    contextBlock,
    instruction,
    markdown,
  });
}

/**
 * ストーリー構想マークダウンから全章・節のプロット構成を生成するプロンプト。
 */
export function generatePlotFromStoryOutline(params: {
  novelTitle: string;
  storyOutline: string;
  settings?: string[];
  characters?: string[];
}): string {
  const settings = params.settings?.length
    ? params.settings.map((s) => `- ${s}`).join("\n")
    : "（指定なし）";
  const characters = params.characters?.length
    ? params.characters.map((c) => `- ${c}`).join("\n")
    : "（指定なし）";

  const template = getPromptTemplate("generatePlotFromStoryOutline");
  return renderPromptTemplate(template.body, {
    characters,
    novelTitle: params.novelTitle,
    settings,
    storyOutline: params.storyOutline,
  });
}
