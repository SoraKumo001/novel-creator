export interface AnalyzeStoryArcContext {
  novelTitle?: string;
  chapters: Array<{
    id: string;
    title: string;
    sections: Array<{
      id: string;
      title: string;
      summary?: string | null;
      contentSnippet?: string;
    }>;
  }>;
}

export function analyzeStoryArcPrompt(context: AnalyzeStoryArcContext): string {
  let prompt = `あなたはプロのストーリーアナリスト・物語構造評論家です。
与えられた小説の各章・各節の構成と内容を分析し、作品全体の「ドラマチック・アーク（物語の起伏）」を客観的にスコアリング・診断してください。

■ 作品名: ${context.novelTitle ?? '未設定'}

■ 章・節構成一覧:
`;

  for (const ch of context.chapters) {
    prompt += `### 章: ${ch.title} (ID: ${ch.id})\n`;
    for (const sec of ch.sections) {
      prompt += `- 節: ${sec.title} (ID: ${sec.id})\n`;
      if (sec.summary) prompt += `  概要: ${sec.summary}\n`;
      if (sec.contentSnippet) prompt += `  本文冒頭/抜粋: ${sec.contentSnippet}\n`;
    }
  }

  prompt += `\n以下の基準で各節を分析し、JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
すべてのテキスト値（summary・pacingCritique・keyEvent・advice 等）は必ず日本語で出力してください。

【スコアリング指標】
- tension: 0〜100 (緊張感・サスペンス・切迫度。0: 平穏な日常, 50: 事件の発生・対立, 100: 究極の決戦・最大の危機)
- valence: -100〜+100 (感情価。-100: 絶望・敗北・深い悲しみ, 0: 中立, +100: 歓喜・大勝利・最高の希望)
- pacing: 0〜100 (ストーリー展開スピード。遅い〜速い)

{
  "summary": "物語全体の構成（起承転結・三幕構成）のバランス評価",
  "pacingCritique": "中だるみ箇所や急展開すぎる箇所の指摘と改善提案",
  "dataPoints": [
    {
      "chapterId": "章ID",
      "chapterTitle": "章タイトル",
      "sectionId": "節ID",
      "sectionTitle": "節タイトル",
      "tension": 65,
      "valence": -20,
      "pacing": 70,
      "keyEvent": "この節の決定的な出来事や感情の転換点（1〜2行）",
      "advice": "この節の盛り上げ方への助言"
    }
  ]
}`;

  return prompt;
}
