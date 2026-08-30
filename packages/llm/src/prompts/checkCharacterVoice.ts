export interface CheckCharacterVoiceContext {
  novelTitle?: string;
  characters: Array<{
    name: string;
    category?: string | null;
    firstPerson?: string | null; // 一人称
    secondPerson?: string | null; // 二人称
    speechPattern?: string | null; // 口調・語尾
    description?: string | null;
  }>;
  body: string;
}

export function checkCharacterVoicePrompt(context: CheckCharacterVoiceContext): string {
  let prompt = `あなたはプロの文芸校正者・キャラクター監修者です。
登録された登場人物の設定（一人称、二人称、口調、性格、特徴など）と、小説本文内のセリフ・発言を精査し、
キャラクター性のブレ（キャラ崩壊）、一人称・二人称の誤用、口調の揺らぎがないかを厳密にチェックしてください。

■ 登録キャラクター一覧:
`;

  for (const char of context.characters) {
    prompt += `- **${char.name}**`;
    if (char.category) prompt += ` (${char.category})`;
    prompt += `\n`;
    if (char.firstPerson) prompt += `  - 一人称: ${char.firstPerson}\n`;
    if (char.secondPerson) prompt += `  - 二人称: ${char.secondPerson}\n`;
    if (char.speechPattern) prompt += `  - 口調・特徴: ${char.speechPattern}\n`;
    if (char.description) prompt += `  - 詳細設定: ${char.description}\n`;
  }

  prompt += `\n■ 精査対象本文:\n\`\`\`\n${context.body}\n\`\`\`\n\n`;

  prompt += `以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
summary・reason・suggestion 等のすべてのテキスト値は必ず日本語で出力してください。
{
  "summary": "全体のキャラクター描写・口調の一貫性に関する総括",
  "issues": [
    {
      "characterName": "対象キャラクター名（不明な場合は推定または'不明'）",
      "dialogue": "本文中の該当セリフ・描写",
      "issueType": "firstPerson" | "secondPerson" | "speechPattern" | "toneShift" | "outOfCharacter",
      "reason": "設定とどのように矛盾しているか、なぜブレているかの説明",
      "suggestion": "設定に忠実な改善セリフ案"
    }
  ]
}`;

  return prompt;
}
