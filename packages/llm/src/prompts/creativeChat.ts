/**
 * 小説創作相談チャット用のシステムプロンプトを構築する。
 */
export interface CreativeChatContext {
  novel?: {
    title: string;
    description?: string | null;
  };
  settings?: string[];
  characters?: string[];
  additionalContext?: string[];
}

export function creativeChatSystemPrompt(context?: CreativeChatContext): string {
  const parts: string[] = [];

  parts.push(`あなたはプロの小説編集者・創作パートナーAIです。
作家であるユーザーと対話しながら、小説の設定（世界観、魔法、地理、文化、歴史等）、登場人物（性格、動機、背景、関係性、口調等）、プロットやストーリー展開、伏線、シーン構成などのアイデア出し・具体化・ブラッシュアップ・壁打ちを全力でサポートしてください。

# 振る舞いとガイドライン
1. **肯定的かつ建設的な提案**: ユーザーのアイデアを尊重しつつ、物語の魅力や深みを増す多角的な提案・選択肢を提示してください。
2. **構造化された分かりやすい回答**: 設定や人物案を提案する際は、見出しや箇条書き、カテゴリ分けを用いて読みやすく整理してください。
3. **対話的な深掘り**: 提案の最後に、次に検討できる論点や問いかけを添えて、対話をスムーズに発展させてください。
4. **設定の整合性**: 提示されている小説情報や既存設定との矛盾がないか意識し、必要に応じて辻褄を合わせる工夫を提案してください。
5. **そのまま使えるテキスト**: 必要に応じて、設定資料や人物シートにコピー＆ペーストしやすいフォーマットで提示してください。`);

  if (context?.novel) {
    parts.push(`\n# 現在相談中の小説情報
- タイトル: ${context.novel.title}
- あらすじ・概要: ${context.novel.description || '（未設定）'}`);

    if (context.settings && context.settings.length > 0) {
      parts.push(`\n# 登録済みの世界観・設定情報
${context.settings.map((s) => `- ${s}`).join('\n')}`);
    }

    if (context.characters && context.characters.length > 0) {
      parts.push(`\n# 登録済みの登場人物情報
${context.characters.map((c) => `- ${c}`).join('\n')}`);
    }

    if (context.additionalContext && context.additionalContext.length > 0) {
      parts.push(`\n# 関連する追加コンテキスト
${context.additionalContext.map((c) => `- ${c}`).join('\n')}`);
    }
  } else {
    parts.push(`\n# コンテキスト
現在、特定の小説は選択されていません。汎用的な小説・創作の相談として応対してください。`);
  }

  return parts.join('\n');
}
