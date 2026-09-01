/**
 * 小説の全体プロットと章立てを生成するプロンプト。
 */
export function plotGeneration(novel: {
  title: string;
  description: string;
  settings?: string[];
  characters?: string[];
}): string {
  const settings = novel.settings?.length
    ? novel.settings.map((s) => `- ${s}`).join("\n")
    : "（指定なし）";
  const characters = novel.characters?.length
    ? novel.characters.map((c) => `- ${c}`).join("\n")
    : "（指定なし）";

  return `あなたはプロの小説家です。以下の情報に基づいて、小説の全体プロットと章立てを生成してください。

# 小説情報
- タイトル: ${novel.title}
- あらすじ: ${novel.description}
- 世界観・設定:
${settings}
- 登場人物:
${characters}

# 指示
1. 起承転結を意識した全体プロットを設計してください。
2. 各章にタイトルと簡潔な概要を付けてください。
3. 章数は物語の規模に応じて適切に決定してください（目安: 8〜20章）。
4. 各章の概要には、その章で起こる主要な出来事と、登場人物の変化・感情の動きを含めてください。
5. 伏線やクライマックス、結末への収束を考慮してください。

# 出力形式
以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "title": "小説タイトル",
  "description": "全体のあらすじ",
  "chapters": [
    {
      "title": "章タイトル",
      "order": 1,
      "summary": "章の概要"
    }
  ]
}`;
}
