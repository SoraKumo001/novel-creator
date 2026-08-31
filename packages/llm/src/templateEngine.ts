export interface TemplateVariables {
  selectedText?: string;
  surroundingText?: string;
  novelTitle?: string;
  chapterTitle?: string;
  sectionTitle?: string;
  sectionSummary?: string;
  characters?: string;
  settings?: string;
  styleGuide?: string;
  instruction?: string;
  customInstruction?: string;
  variantIndex?: number;
  [key: string]: string | number | undefined;
}

/**
 * テンプレート文字列内の `{variableName}` を対応する値で置換します。
 */
export function renderPromptTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    // instruction と customInstruction のエイリアス対応
    if (key === 'instruction' && variables.instruction === undefined) {
      if (variables.customInstruction !== undefined) {
        return String(variables.customInstruction);
      }
    }
    if (key === 'customInstruction' && variables.customInstruction === undefined) {
      if (variables.instruction !== undefined) {
        return String(variables.instruction);
      }
    }

    const value = variables[key];
    if (value === undefined || value === null) {
      return '';
    }
    return String(value);
  });
}

/**
 * 利用可能なプロンプト変数定義リスト（UI表示・補完用）
 */
export const AVAILABLE_PROMPT_VARIABLES = [
  { key: '{selectedText}', label: '選択テキスト', description: 'エディタで選択中のテキスト' },
  { key: '{surroundingText}', label: '前後の文脈', description: '選択範囲の前後文脈' },
  { key: '{instruction}', label: '追加指示', description: '実行時に入力された自由指示' },
  { key: '{novelTitle}', label: '作品タイトル', description: '小説のタイトル' },
  { key: '{sectionTitle}', label: '節タイトル', description: '現在の節のタイトル' },
  { key: '{sectionSummary}', label: '節の概要', description: '現在の節のプロット概要' },
  { key: '{characters}', label: '登場人物情報', description: '関連キャラクターの設定・口調' },
  { key: '{settings}', label: '世界観設定', description: '関連する世界観・用語設定' },
  { key: '{styleGuide}', label: '文体ガイドライン', description: '作品全体の執筆方針' },
] as const;
