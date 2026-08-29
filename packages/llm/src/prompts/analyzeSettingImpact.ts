export interface AnalyzeSettingImpactContext {
  novelTitle?: string;
  changeTarget: 'character' | 'setting';
  targetName: string;
  beforeValue: string;
  afterValue: string;
  plots?: string;
  chapters?: Array<{
    title: string;
    sections: Array<{
      title: string;
      summary?: string | null;
      contentSnippet?: string;
    }>;
  }>;
  timelines?: Array<{
    title: string;
    era?: string | null;
    description?: string | null;
  }>;
  foreshadowings?: Array<{
    title: string;
    description?: string | null;
  }>;
}

export function analyzeSettingImpactPrompt(context: AnalyzeSettingImpactContext): string {
  let prompt = `あなたはプロの小説構成作家・シリーズ構成アシスタントです。
小説内の設定（またはキャラクター）が変更された際に、既存のプロット・章・節・タイムライン・伏線にどのような影響や矛盾が生じるかを網羅的に分析し、必要な修正箇所とリライト案を特定してください。

■ 作品情報: ${context.novelTitle ?? '未設定'}
■ 変更対象: ${context.changeTarget === 'character' ? '登場人物' : '世界観設定'}「${context.targetName}」

■ 変更前（旧設定）:
\`\`\`
${context.beforeValue}
\`\`\`

■ 変更後（新設定）:
\`\`\`
${context.afterValue}
\`\`\`

`;

  if (context.plots) {
    prompt += `■ 全体プロット:\n${context.plots}\n\n`;
  }

  if (context.chapters && context.chapters.length > 0) {
    prompt += `■ 章・節一覧と概要:\n`;
    for (const ch of context.chapters) {
      prompt += `### ${ch.title}\n`;
      for (const sec of ch.sections) {
        prompt += `- **${sec.title}**: ${sec.summary || '概要なし'}\n`;
        if (sec.contentSnippet) {
          prompt += `  (本文抜粋: ${sec.contentSnippet})\n`;
        }
      }
    }
    prompt += `\n`;
  }

  if (context.timelines && context.timelines.length > 0) {
    prompt += `■ 年表・時系列:\n`;
    for (const tl of context.timelines) {
      prompt += `- [${tl.era || '時期不明'}] ${tl.title}: ${tl.description || ''}\n`;
    }
    prompt += `\n`;
  }

  if (context.foreshadowings && context.foreshadowings.length > 0) {
    prompt += `■ 伏線一覧:\n`;
    for (const fs of context.foreshadowings) {
      prompt += `- ${fs.title}: ${fs.description || ''}\n`;
    }
    prompt += `\n`;
  }

  prompt += `以下の JSON 形式で出力してください。JSON 以外のテキストは含めないでください。
{
  "summary": "この設定変更が作品全体に与える影響の総括（難易度や変更規模）",
  "impactLevel": "low" | "medium" | "high",
  "affectedItems": [
    {
      "targetType": "plot" | "section" | "timeline" | "foreshadowing",
      "targetTitle": "影響を受ける章・節・タイムライン名など",
      "issue": "発生する具体的な矛盾や違和感の説明",
      "suggestedFix": "解消するための具体的な修正案（プロット/概要/本文の変更案）"
    }
  ]
}`;

  return prompt;
}
