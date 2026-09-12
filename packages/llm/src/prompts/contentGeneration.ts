import { renderPromptTemplate } from "../templateEngine.js";
import { truncateHead, truncateTailShared } from "../truncate.js";
import { getPromptTemplate } from "./loader.js";

const TOTAL_CONTEXT_LIMIT = 8000;
const CHARACTER_ITEM_LIMIT = 500;
const CHARACTER_MAX_ITEMS = 5;
const SETTING_ITEM_LIMIT = 500;
const SETTING_MAX_ITEMS = 5;
const CONTENT_ITEM_LIMIT = 1200;
const CONTENT_MAX_ITEMS = 3;
const FORESHADOWING_ITEM_LIMIT = 400;
const FORESHADOWING_MAX_ITEMS = 3;
const GLOSSARY_ITEM_LIMIT = 400;
const GLOSSARY_MAX_ITEMS = 5;

/**
 * Phase1: 共通の切り詰めヘルパ（先頭優先・共有実装へ委譲）。
 */
function truncate(text: string, limit: number): string {
  return truncateHead(text, limit);
}

/**
 * Phase1: 直前文脈用の末尾優先切り詰め。接続部（末尾）を残す（共有実装へ委譲）。
 */
function truncateTail(text: string, limit: number): string {
  return truncateTailShared(text, limit);
}

function formatList(
  items: string[] | undefined,
  itemLimit: number,
  maxItems: number
): string {
  if (!items || items.length === 0) {
    return "(関連情報なし)";
  }
  return items
    .slice(0, maxItems)
    .map((item) => `- ${truncate(item, itemLimit)}`)
    .join("\n");
}

/**
 * Phase1: 総量が上限を超えた場合、直前文 > 伏線 > 本文 > 人物/設定 の優先度で
 * 低優先ブロックから切り詰める。直前文は末尾優先、その他は先頭優先。
 */
function applyTotalBudget(blocks: {
  characters: string;
  contents: string;
  foreshadowings: string;
  glossaries: string;
  previousContent: string;
  settings: string;
}): typeof blocks {
  const total =
    blocks.previousContent.length +
    blocks.foreshadowings.length +
    blocks.contents.length +
    blocks.characters.length +
    blocks.settings.length +
    blocks.glossaries.length;
  if (total <= TOTAL_CONTEXT_LIMIT) {
    return blocks;
  }
  // 高優先から割り当て、低優先は残余のみ受け取る
  // 用語集は既存予算内で最下位優先（既存budget流用・総量不変）
  let remaining = TOTAL_CONTEXT_LIMIT;
  const previousContent = truncateTail(
    blocks.previousContent,
    Math.min(blocks.previousContent.length, remaining)
  );
  remaining = Math.max(0, remaining - previousContent.length);
  const foreshadowings = truncate(
    blocks.foreshadowings,
    Math.min(blocks.foreshadowings.length, remaining)
  );
  remaining = Math.max(0, remaining - foreshadowings.length);
  const contents = truncate(
    blocks.contents,
    Math.min(blocks.contents.length, remaining)
  );
  remaining = Math.max(0, remaining - contents.length);
  const characters = truncate(
    blocks.characters,
    Math.min(blocks.characters.length, remaining)
  );
  remaining = Math.max(0, remaining - characters.length);
  const settings = truncate(
    blocks.settings,
    Math.min(blocks.settings.length, remaining)
  );
  remaining = Math.max(0, remaining - settings.length);
  const glossaries = truncate(
    blocks.glossaries,
    Math.min(blocks.glossaries.length, remaining)
  );
  return {
    characters,
    contents,
    foreshadowings,
    glossaries,
    previousContent,
    settings,
  };
}

/**
 * 本文を生成するプロンプト。前の文脈、章情報、登場人物、設定を考慮する。
 */
export function contentGeneration(
  section: { title?: string; summary: string },
  context: {
    chapter?: { summary?: string | null; title?: string };
    characters?: string[];
    contents?: string[];
    foreshadowings?: string[];
    glossaries?: string[];
    previousContent?: string;
    settings?: string[];
    styleGuide?: string | null;
  }
): string {
  const sectionTitle = section.title ?? "（未設定）";
  const rawBlocks = {
    characters: formatList(
      context.characters,
      CHARACTER_ITEM_LIMIT,
      CHARACTER_MAX_ITEMS
    ),
    contents: formatList(
      context.contents,
      CONTENT_ITEM_LIMIT,
      CONTENT_MAX_ITEMS
    ),
    foreshadowings: formatList(
      context.foreshadowings,
      FORESHADOWING_ITEM_LIMIT,
      FORESHADOWING_MAX_ITEMS
    ),
    glossaries: formatList(
      context.glossaries,
      GLOSSARY_ITEM_LIMIT,
      GLOSSARY_MAX_ITEMS
    ),
    previousContent: context.previousContent
      ? truncateTail(context.previousContent, 4000)
      : "（前の文脈なし）",
    settings: formatList(
      context.settings,
      SETTING_ITEM_LIMIT,
      SETTING_MAX_ITEMS
    ),
  };
  const budgeted = applyTotalBudget(rawBlocks);
  const previousContent = budgeted.previousContent;
  const characters = context.characters?.length
    ? budgeted.characters
    : "（指定なし）";
  const settings = context.settings?.length
    ? budgeted.settings
    : "（指定なし）";
  const contents = budgeted.contents;
  const foreshadowings = budgeted.foreshadowings;
  const glossaries = budgeted.glossaries;
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
  const rendered = renderPromptTemplate(template.body, {
    chapterSection,
    characters,
    contents,
    foreshadowings,
    previousContent,
    sectionSummary: section.summary,
    sectionTitle,
    settings,
    styleGuideInstruction,
    styleGuideSection,
  });
  if (!context.glossaries?.length) {
    return rendered;
  }
  const glossarySection = `# 用語集（表記・定義の遵守対象）\n${glossaries}\n※上記の用語の表記・読み・定義と矛盾する用法は禁止します。必要な範囲で自然に用いてください。\n\n`;
  const anchor = "# 関連する過去の本文抜粋";
  if (rendered.includes(anchor)) {
    return rendered.replace(anchor, `${glossarySection}${anchor}`);
  }
  return `${rendered}\n\n${glossarySection}`;
}
