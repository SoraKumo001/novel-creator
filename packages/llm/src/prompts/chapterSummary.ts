/**
 * 個別の章の詳細な概要を生成するプロンプト。
 */
export function chapterSummary(
  novel: { title: string; description: string },
  chapter: { title: string; order: number; summary?: string }
): string {
  const existingSummary = chapter.summary ?? "（未設定）";

  return `あなたはプロの小説家です。小説の特定の章について、詳細な概要を生成してください。

# 小説情報
- タイトル: ${novel.title}
- あらすじ: ${novel.description}

# 対象の章
- 章タイトル: ${chapter.title}
- 章番号: ${chapter.order}
- 既存の概要: ${existingSummary}

# 指示
1. 章の概要を、起承転結を意識して詳細に展開してください。
2. その章で起こる出来事を時系列に沿って具体的に記述してください。
3. 登場人物の行動・台詞・感情の変化を含めてください。
4. 前後の章とのつながりや、物語全体への影響を考慮してください。
5. 章のクライマックスと、その章の結末を明確にしてください。

# 出力形式
以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "title": "章タイトル",
  "order": ${chapter.order},
  "summary": "詳細な章の概要"
}`;
}
