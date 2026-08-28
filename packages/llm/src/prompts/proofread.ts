export interface ProofreadContext {
  novelTitle?: string;
  chapterTitle?: string;
  sectionTitle?: string;
  sectionSummary?: string;
  characters?: string;
  settings?: string;
  body: string;
}

export function proofreadPrompt(context: ProofreadContext): string {
  let prompt = `あなたはプロの文芸編集者・校正者・ライトノベル作家です。
以下の小説の本文を精読し、プロフェッショナルな視点から校正・推敲・レビューを行ってください。

【評価・推敲の重点ポイント】
1. **視点（POV）のブレ**: 一人称/三人称の視点混同や、主人公が見聞きできない情報の不自然な描写がないか。
2. **誤字・脱字・表記揺れ・助詞**: 誤用、表記ゆれ（例：「子供」と「子ども」）、助詞の連続や不自然な係り受け。
3. **文体・リズム・テンポ**: 語尾の単調な連続（「〜だった。〜だった。」）、冗長な修飾、テンポの悪さの改善。
4. **感情描写・臨場感**: 読者が感情移入しやすい五感を使った描写や、キャラクターの個性・感情の鮮やかさ。
5. **設定・文脈の整合性**: 提示された設定やキャラクター像と矛盾していないか。

`;

  if (context.novelTitle) {
    prompt += `■ 作品タイトル: ${context.novelTitle}\n`;
  }
  if (context.chapterTitle) {
    prompt += `■ 章タイトル: ${context.chapterTitle}\n`;
  }
  if (context.sectionTitle) {
    prompt += `■ 節タイトル: ${context.sectionTitle}\n`;
  }
  if (context.sectionSummary) {
    prompt += `■ 節のあらすじ: ${context.sectionSummary}\n`;
  }
  if (context.characters) {
    prompt += `■ 関連キャラクター情報:\n${context.characters}\n\n`;
  }
  if (context.settings) {
    prompt += `■ 関連設定・世界観:\n${context.settings}\n\n`;
  }

  prompt += `■ 対象本文:
\`\`\`
${context.body}
\`\`\`

以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "score": 85,
  "critique": "編集者・査読者視点からの総評（良かった点・作品の魅力）",
  "advice": "より面白く・引き込まれる文章にするための具体的なアドバイス",
  "issues": [
    {
      "type": "viewpoint" | "typo" | "grammar" | "pacing" | "consistency" | "other",
      "originalText": "指摘箇所の原文テキスト",
      "suggestion": "改善案・修正案",
      "reason": "なぜ修正した方がよいかの理由・解説"
    }
  ],
  "polishedBody": "元のプロットやキャラクターの個性を活かしつつ、魅力を高めた推敲後の全文案"
}`;

  return prompt;
}
