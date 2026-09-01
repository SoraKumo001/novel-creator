export interface TemplateVariables {
  chapterTitle?: string;
  characters?: string;
  customInstruction?: string;
  instruction?: string;
  novelTitle?: string;
  sectionSummary?: string;
  sectionTitle?: string;
  selectedText?: string;
  settings?: string;
  styleGuide?: string;
  surroundingText?: string;
  variantIndex?: number;
  [key: string]: string | number | undefined;
}

/**
 * テンプレート文字列内の `{variableName}` を対応する値で置換します。
 */
export function renderPromptTemplate(
  template: string,
  variables: TemplateVariables
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    // instruction と customInstruction のエイリアス対応
    if (
      key === "instruction" &&
      variables.instruction === undefined &&
      variables.customInstruction !== undefined
    ) {
      return String(variables.customInstruction);
    }
    if (
      key === "customInstruction" &&
      variables.customInstruction === undefined &&
      variables.instruction !== undefined
    ) {
      return String(variables.instruction);
    }

    const value = variables[key];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  });
}

/**
 * 利用可能なプロンプト変数定義リスト（UI表示・補完用）
 */
export const AVAILABLE_PROMPT_VARIABLES = [
  {
    description: "エディタで選択中のテキスト",
    key: "{selectedText}",
    label: "選択テキスト",
  },
  {
    description: "選択範囲の前後文脈",
    key: "{surroundingText}",
    label: "前後の文脈",
  },
  {
    description: "実行時に入力された自由指示",
    key: "{instruction}",
    label: "追加指示",
  },
  { description: "小説のタイトル", key: "{novelTitle}", label: "作品タイトル" },
  {
    description: "現在の節のタイトル",
    key: "{sectionTitle}",
    label: "節タイトル",
  },
  {
    description: "現在の節のプロット概要",
    key: "{sectionSummary}",
    label: "節の概要",
  },
  {
    description: "関連キャラクターの設定・口調",
    key: "{characters}",
    label: "登場人物情報",
  },
  {
    description: "関連する世界観・用語設定",
    key: "{settings}",
    label: "世界観設定",
  },
  {
    description: "作品全体の執筆方針",
    key: "{styleGuide}",
    label: "文体ガイドライン",
  },
] as const;
