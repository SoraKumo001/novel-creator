export type ReaderPersonaType =
  | "editor" // 商業文芸・ラノベ編集者（構成・引き・商業性重視）
  | "casual" // 一般エンタメ読者（面白さ・感情移入・爽快感重視）
  | "lore" // 世界観・考察派読者（設定の緻密さ・伏線重視）
  | "critic"; // 辛口文学評論家（文体・テーマ性・心理描写重視）

export interface MultiPersonaReviewContext {
  chapterTitle?: string;
  genre?: string;
  novelTitle?: string;
  sectionTitle?: string;
  targetAudience?: string;
  text: string;
}

export function multiPersonaReviewPrompt(
  context: MultiPersonaReviewContext
): string {
  let prompt = `あなたは多様な視点を持つ小説の査読チーム（編集者、ライト読者、設定考察派ファン、辛口文芸評論家）です。
以下の小説テキストを精読し、4つの異なるペルソナになりきって独自の視点から感想・評価・改善点をフィードバックしてください。

■ 作品情報:
- タイトル: ${context.novelTitle ?? "未設定"}
`;

  if (context.genre) {
    prompt += `- ジャンル: ${context.genre}\n`;
  }
  if (context.targetAudience) {
    prompt += `- ターゲット層: ${context.targetAudience}\n`;
  }
  if (context.chapterTitle) {
    prompt += `- 対象章: ${context.chapterTitle}\n`;
  }
  if (context.sectionTitle) {
    prompt += `- 対象節: ${context.sectionTitle}\n`;
  }

  prompt += `\n■ 対象本文:\n\`\`\`\n${context.text}\n\`\`\`\n\n`;

  prompt += `以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
overallImpression・catchphrase・praise・criticism・advice 等のすべてのテキスト値は必ず日本語で出力してください。personaName は指定された日本語名称をそのまま使用してください。
{
  "overallImpression": "チーム全体の総合的な読後感まとめ",
  "reviews": [
    {
      "persona": "editor",
      "personaName": "商業ラノベ・文芸編集者",
      "rating": 4, // 1〜5
      "catchphrase": "編集者のキャッチコピー（例:「プロットの推進力は抜群。第3節の引きを強化すれば書籍化レベル！」）",
      "praise": "商業的・構成的に優れている点（引きの強さ、キャラ立ち、掴みなど）",
      "criticism": "商業作品としての改善要求（テンポ、読者の離脱リスクなど）",
      "advice": "次に何をリライトすべきかのプロのアドバイス"
    },
    {
      "persona": "casual",
      "personaName": "一般エンタメ読者",
      "rating": 5,
      "catchphrase": "読者の素直な一言（例:「主人公がピンチを脱出するシーンが熱かった！」）",
      "praise": "読んでいてワクワクした点、推せるポイント",
      "criticism": "読んでいて引っかかった点、退屈に感じた箇所",
      "advice": "「もっとこういうシーンが見たい！」という読者目線の要望"
    },
    {
      "persona": "lore",
      "personaName": "世界観・設定考察派ファン",
      "rating": 4,
      "catchphrase": "考察班の一言（例:「魔法の発動条件に深い裏設定を感じる。伏線回収が楽しみ」）",
      "praise": "世界観のオリジナリティや設定の説得力、伏線の仕込み",
      "criticism": "設定の矛盾点、説明不足や説明過多（説明セリフ）の指摘",
      "advice": "より重厚な世界観に見せるためのアドバイス"
    },
    {
      "persona": "critic",
      "personaName": "辛口文芸評論家",
      "rating": 3,
      "catchphrase": "批評家の一言（例:「描写力は高いが、心理の陰影をもう少し掘り下げられるはず」）",
      "praise": "文章のリズム、語彙の豊かさ、テーマの深み",
      "criticism": "安易なクリシェ（常套句）や浅い感情描写への厳しい指摘",
      "advice": "文学的・表現的完成度を高めるための助言"
    }
  ]
}`;

  return prompt;
}
