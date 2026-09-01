/**
 * 節（セクション）の概要を生成するプロンプト。
 */
export function sectionSummary(
  chapter: { title: string; summary: string },
  section: { title?: string; order: number }
): string {
  const sectionTitle = section.title ?? "（未設定）";

  return `あなたはプロの小説家です。章の中の特定の節について、概要を生成してください。

# 章情報
- 章タイトル: ${chapter.title}
- 章の概要: ${chapter.summary}

# 対象の節
- 節タイトル: ${sectionTitle}
- 節番号: ${section.order}

# 指示
1. 章の概要を踏まえて、この節で描くべき内容を具体的に決定してください。
2. 節の目的（場面転換、会話、アクション、心理描写など）を明確にしてください。
3. 節の冒頭と結末が自然につながるようにしてください。
4. この節で読者に伝えるべき情報・感情・伏線を列挙してください。

# 出力形式
以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "title": "節タイトル",
  "order": ${section.order},
  "summary": "節の具体的な概要"
}`;
}
