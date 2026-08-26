/**
 * 設定のドラフトを LLM で生成・反復修正するプロンプト。
 */
export function createSettingDraft(
  instruction: string,
  currentDraft?: { category: string; name: string; description?: string },
): string {
  if (!currentDraft) {
    return `あなたは小説の設定を管理する編集者です。以下の指示に従って、新しい設定のドラフトを生成してください。

# 生成指示
${instruction}

# 指示
1. 生成指示に忠実に従い、設定のドラフトを作成してください。
2. 設定が小説の世界観に自然に溶け込むように、具体的に記述してください。
3. カテゴリ・名前・説明を明確に定義してください。
4. description はマークダウン形式（リスト、太字など）で記述してください。

# 出力形式
以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "category": "設定のカテゴリ",
  "name": "設定の名前",
  "description": "設定の説明（マークダウン形式）"
}`;
  }

  const description = currentDraft.description ?? '（未設定）';

  return `あなたは小説の設定を管理する編集者です。以下の設定のドラフトを、指示に従って修正してください。

# 現在のドラフト
- カテゴリ: ${currentDraft.category}
- 名前: ${currentDraft.name}
- 説明: ${description}

# 修正指示
${instruction}

# 指示
1. 修正指示に忠実に従い、設定のドラフトを更新してください。
2. 既存の情報と矛盾しないように、一貫性を保ってください。
3. 指示にない部分は、可能な限り既存の情報を維持してください。
4. 設定が小説の世界観に自然に溶け込むように、具体的に記述してください。
5. description はマークダウン形式（リスト、太字など）で記述してください。

# 出力形式
以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "category": "設定のカテゴリ",
  "name": "設定の名前",
  "description": "設定の説明（マークダウン形式）"
}`;
}
