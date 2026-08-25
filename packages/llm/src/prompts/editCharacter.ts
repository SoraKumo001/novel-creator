/**
 * 人物情報を LLM で編集するプロンプト。
 */
export function editCharacter(
  character: { name: string; description?: string; traits?: string[] },
  instruction: string,
): string {
  const description = character.description ?? '（未設定）';
  const traits = character.traits?.length
    ? character.traits.map((t) => `- ${t}`).join('\n')
    : '（未設定）';

  return `あなたは小説の登場人物を管理する編集者です。以下の人物情報を、指示に従って編集してください。

# 人物情報
- 名前: ${character.name}
- 説明: ${description}
- 特徴・性格:
${traits}

# 編集指示
${instruction}

# 指示
1. 編集指示に忠実に従い、人物情報を更新してください。
2. 既存の情報と矛盾しないように、一貫性を保ってください。
3. 指示にない部分は、可能な限り既存の情報を維持してください。
4. 人物の性格・外見・背景・能力などを、小説に活かせる形で具体的に記述してください。

# 出力形式
以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "name": "人物の名前",
  "description": "人物の説明",
  "traits": ["性格・特徴1", "性格・特徴2"]
}`;
}
