/**
 * 伏線のドラフトを LLM で生成・反復修正するプロンプト。
 */
export function createForeshadowingDraft(
  instruction: string,
  currentDraft?: {
    category?: string;
    title: string;
    description?: string;
    status?: string;
  }
): string {
  if (!currentDraft) {
    return `あなたは小説の構成・伏線を管理する編集者です。以下の指示に従って、新しい伏線・フラグのドラフトを生成してください。

# 生成指示
${instruction}

# 指示
1. 生成指示に忠実に従い、伏線のドラフトを作成してください。
2. 伏線がストーリーに魅力的な謎やカタルシスをもたらすよう、具体的に記述してください。
3. カテゴリ・タイトル・詳細メモ・ステータス（未回収: unresolved）を定義してください。
4. description はマークダウン形式（リスト、太字など）で記述してください。

# 出力形式
以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "category": "伏線のカテゴリ（スラッシュ区切りで階層化可能。例: 主要伏線, 主要伏線 / 主人公の謎, 世界観 / 禁忌）",
  "title": "伏線・フラグのタイトル",
  "description": "伏線の詳細メモ（意図、回収アイデア、関連人物など。マークダウン形式）",
  "status": "unresolved"
}`;
  }

  const category = currentDraft.category ?? "未分類";
  const description = currentDraft.description ?? "（未設定）";
  const status = currentDraft.status ?? "unresolved";

  return `あなたは小説の構成・伏線を管理する編集者です。以下の伏線のドラフトを、指示に従って修正してください。

# 現在のドラフト
- カテゴリ: ${category}
- 伏線タイトル: ${currentDraft.title}
- ステータス: ${status}
- 詳細メモ: ${description}

# 修正指示
${instruction}

# 指示
1. 修正指示に忠実に従い、伏線のドラフトを更新してください。
2. 既存の情報と矛盾しないように、一貫性を保ってください。
3. 指示にない部分は、可能な限り既存の情報を維持してください。
4. description はマークダウン形式（リスト、太字など）で記述してください。

# 出力形式
以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "category": "伏線のカテゴリ（スラッシュ区切りで階層化可能。例: 主要伏線, 主要伏線 / 主人公の謎, 世界観 / 禁忌）",
  "title": "伏線・フラグのタイトル",
  "description": "伏線の詳細メモ（マークダウン形式）",
  "status": "${status}"
}`;
}
