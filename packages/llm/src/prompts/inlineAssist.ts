export type InlineAssistAction =
  | 'expand' // 描写・五感・情景を膨らませる
  | 'shorten' // 簡潔・スピーディーに
  | 'emotional' // 感情・心理描写を高める
  | 'dialogue' // セリフをより生き生きと・テンポよく
  | 'paraphrase' // 別の表現・言い回し
  | 'custom'; // 自由な指示

export interface InlineAssistContext {
  novelTitle?: string;
  characters?: string;
  surroundingText?: string;
  selectedText: string;
  action: InlineAssistAction;
  customInstruction?: string;
}

const ACTION_DESCRIPTIONS: Record<InlineAssistAction, string> = {
  expand:
    '選択されたテキストを基に、五感（視覚・聴覚・触覚・嗅覚・味覚）や情景描写、周囲の雰囲気を豊かに肉付けして加筆してください。',
  shorten:
    '選択されたテキストの要点を残しつつ、冗長な表現を削ぎ落としてテンポよく簡潔にまとめてください。',
  emotional:
    '登場人物の内面心理、葛藤、微細な感情の揺れ動きを深く描き込む表現に書き換えてください。',
  dialogue:
    'キャラクターの個性や口調を際立たせ、会話の掛け合いをテンポよく魅力的に書き換えてください。',
  paraphrase:
    '同じ意味合いを別の表現や比喩、文学的な言い回しを用いて魅力的に書き換えてください。3パターンの候補を提示するのではなく、最も完成度の高い1つの文章を出力してください。',
  custom: '作家からの個別指示に従って書き換えてください。',
};

export function inlineAssistPrompt(context: InlineAssistContext): string {
  let prompt = `あなたはプロの小説執筆アシスタントです。
作家が執筆中の小説本文の一部（選択範囲）に対して、指定された方針で推敲・書き換え・加筆を行ってください。

【最重要ルール】
- 前後の文脈に自然に繋がる文章にしてください。
- 登場人物の口調や作品の世界観を崩さないでください。
- 余計な挨拶や解説（「以下のように書き換えました」等）は一切含めず、**書き換え後の本文テキストのみ**を出力してください。
- ルビ記法（|漢字《かんじ》）が含まれる場合は適切に保持・活用してください。

`;

  if (context.novelTitle) {
    prompt += `■ 作品タイトル: ${context.novelTitle}\n`;
  }
  if (context.characters) {
    prompt += `■ 関連キャラクター情報:\n${context.characters}\n\n`;
  }
  if (context.surroundingText) {
    prompt += `■ 前後の文脈:\n${context.surroundingText}\n\n`;
  }

  prompt += `■ 指針: ${ACTION_DESCRIPTIONS[context.action]}\n`;
  if (context.action === 'custom' && context.customInstruction) {
    prompt += `■ 作家からの指示: ${context.customInstruction}\n`;
  }

  prompt += `\n■ 書き換え対象テキスト:\n"""\n${context.selectedText}\n"""\n\n書き換え後のテキストのみを出力してください:`;

  return prompt;
}
