import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

export type InlineAssistAction =
  | "expand" // 描写・五感・情景を膨らませる
  | "shorten" // 簡潔・スピーディーに
  | "emotional" // 感情・心理描写を高める
  | "dialogue" // セリフをより生き生きと・テンポよく
  | "paraphrase" // 別の表現・言い回し
  | "custom" // 自由な指示
  | "template"; // カスタムテンプレート

export interface InlineAssistContext {
  action: InlineAssistAction;
  chapterTitle?: string;
  characters?: string;
  customInstruction?: string;
  customTemplate?: string;
  novelTitle?: string;
  sectionSummary?: string;
  sectionTitle?: string;
  selectedText: string;
  settings?: string;
  styleGuide?: string;
  surroundingText?: string;
  totalVariants?: number;
  variantIndex?: number;
}

const ACTION_DESCRIPTIONS: Record<InlineAssistAction, string> = {
  custom: "作家からの個別指示に従って書き換えてください。",
  dialogue:
    "キャラクターの個性や口調を際立たせ、会話の掛け合いをテンポよく魅力的に書き換えてください。",
  emotional:
    "登場人物の内面心理、葛藤、微細な感情の揺れ動きを深く描き込む表現に書き換えてください。",
  expand:
    "選択されたテキストを基に、五感（視覚・聴覚・触覚・嗅覚・味覚）や情景描写、周囲の雰囲気を豊かに肉付けして加筆してください。",
  paraphrase:
    "同じ意味合いを別の表現や比喩、文学的な言い回しを用いて魅力的に書き換えてください。",
  shorten:
    "選択されたテキストの要点を残しつつ、冗長な表現を削ぎ落としてテンポよく簡潔にまとめてください。",
  template:
    "指定されたカスタムプロンプトテンプレートに従って推敲・書き換えを行ってください。",
};

const VARIANT_HINTS: Record<number, string> = {
  1: "【バリエーション方針 案1】文脈に忠実で最も自然かつ王道なバランスの取れた表現にしてください。",
  2: "【バリエーション方針 案2】より感情やドラマ性・空気感を際立たせ、印象的な表現・語彙を使ってください。",
  3: "【バリエーション方針 案3】テンポ感やリズムを重視し、キレのあるダイナミックな表現にしてください。",
};

export function inlineAssistPrompt(context: InlineAssistContext): string {
  // カスタムテンプレートが指定されている場合はテンプレートエンジンで変数展開
  if (context.action === "template" && context.customTemplate) {
    let rendered = renderPromptTemplate(context.customTemplate, {
      chapterTitle: context.chapterTitle,
      characters: context.characters,
      customInstruction: context.customInstruction,
      instruction: context.customInstruction,
      novelTitle: context.novelTitle,
      sectionSummary: context.sectionSummary,
      sectionTitle: context.sectionTitle,
      selectedText: context.selectedText,
      settings: context.settings,
      styleGuide: context.styleGuide,
      surroundingText: context.surroundingText,
      variantIndex: context.variantIndex,
    });

    if (
      context.totalVariants &&
      context.totalVariants > 1 &&
      context.variantIndex
    ) {
      const hint =
        VARIANT_HINTS[context.variantIndex] ||
        `【バリエーション 案${context.variantIndex}】他の候補と表現や語彙の切り口を変えてください。`;
      rendered = `${hint}\n\n${rendered}`;
    }

    return rendered;
  }

  let variantHint = "";
  if (
    context.totalVariants &&
    context.totalVariants > 1 &&
    context.variantIndex
  ) {
    const hint =
      VARIANT_HINTS[context.variantIndex] ||
      `【バリエーション 案${context.variantIndex}】`;
    variantHint = `${hint}\n\n`;
  }

  let contextSections = "";
  if (context.novelTitle) {
    contextSections += `■ 作品タイトル: ${context.novelTitle}\n`;
  }
  if (context.styleGuide) {
    contextSections += `■ 作品の執筆スタイル・文体ガイドライン:\n${context.styleGuide}\n\n`;
  }
  if (context.characters) {
    contextSections += `■ 関連キャラクター情報:\n${context.characters}\n\n`;
  }
  if (context.surroundingText) {
    contextSections += `■ 前後の文脈:\n${context.surroundingText}\n\n`;
  }

  let customInstructionSection = "";
  if (
    (context.action === "custom" || context.customInstruction) &&
    context.customInstruction
  ) {
    customInstructionSection = `■ 作家からの指示: ${context.customInstruction}\n`;
  }

  const template = getPromptTemplate("inlineAssist");
  return renderPromptTemplate(template.body, {
    actionDescription: ACTION_DESCRIPTIONS[context.action],
    contextSections,
    customInstructionSection,
    selectedText: context.selectedText,
    variantHint,
  });
}
