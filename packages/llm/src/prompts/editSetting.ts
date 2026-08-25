/**
 * 設定情報を LLM で編集するプロンプト。
 */
export function editSetting(
  setting: { category: string; name: string; description?: string },
  instruction: string,
): string {
  const description = setting.description ?? '（未設定）';

  return `あなたは小説の設定を管理する編集者です。以下の設定情報を、指示に従って編集してください。

# 設定情報
- カテゴリ: ${setting.category}
- 名前: ${setting.name}
- 説明: ${description}

# 編集指示
${instruction}

# 指示
1. 編集指示に忠実に従い、設定情報を更新してください。
2. 既存の情報と矛盾しないように、一貫性を保ってください。
3. 指示にない部分は、可能な限り既存の情報を維持してください。
4. 設定が小説の世界観に自然に溶け込むように、具体的に記述してください。

# 出力形式
以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "category": "設定のカテゴリ",
  "name": "設定の名前",
  "description": "設定の説明"
}`;
}
