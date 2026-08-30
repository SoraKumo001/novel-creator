/**
 * ストーリー構想（あらすじ・今後の展開・結末・メモ等）用の LLM プロンプト群。
 */

/**
 * ストーリー構想マークダウンの特定セクションを編集するプロンプト。
 */
export function editStoryOutlineSection(
  section: {
    category: string;
    name: string;
    content: string;
  },
  instruction: string,
  context?: {
    novelTitle?: string;
    settings?: string[];
    characters?: string[];
    entireOutlinePreview?: string;
  },
): string {
  const content = section.content.trim() || '（未記入）';

  const contextLines: string[] = [];
  if (context?.novelTitle) {
    contextLines.push(`- 作品タイトル: ${context.novelTitle}`);
  }
  if (context?.characters && context.characters.length > 0) {
    contextLines.push('## 登場人物');
    contextLines.push(...context.characters.map((c) => `- ${c}`));
  }
  if (context?.settings && context.settings.length > 0) {
    contextLines.push('## 世界観・設定');
    contextLines.push(...context.settings.map((s) => `- ${s}`));
  }
  if (context?.entireOutlinePreview) {
    contextLines.push('## ストーリー構想全体（文脈参考）');
    contextLines.push(context.entireOutlinePreview);
  }
  const contextBlock = contextLines.length > 0 ? contextLines.join('\n') : '（なし）';

  return `あなたはプロの小説ストーリーアーキテクト（構成作家・編集者）です。以下のストーリー構想の特定セクションを、作家の指示に従って推敲・展開・修正してください。

# 対象セクション
- 大見出し/カテゴリ: ${section.category}
- セクション名: ${section.name}
- 現在の内容:
${content}

# 編集・相談指示
${instruction}

# 作品コンテキスト（参考）
${contextBlock}

# 指示
1. 作家の編集・相談指示に忠実に従い、セクション内容を推敲・加筆・修正してください。
2. マークダウンの書式（箇条書き、太字など）を適切に活用してください。
3. 他のセクションや登場人物・世界観設定と矛盾しないように整合性を保ってください。
4. アイデア提案や分岐案を求められた場合は、具体的かつ魅力的な選択肢を提示してください。
5. 出力はセクション本文のみとし、見出し（# や ##）や「了解しました」等の挨拶文・解説は含めないでください。

# 出力形式
編集後のセクション本文のみをマークダウン形式で出力してください。`;
}

/**
 * ストーリー構想マークダウン全体を編集するプロンプト。
 */
export function editStoryOutlineDocument(
  markdown: string,
  instruction: string,
  context?: {
    novelTitle?: string;
    settings?: string[];
    characters?: string[];
  },
): string {
  const contextLines: string[] = [];
  if (context?.novelTitle) {
    contextLines.push(`- 作品タイトル: ${context.novelTitle}`);
  }
  if (context?.characters && context.characters.length > 0) {
    contextLines.push('## 登場人物');
    contextLines.push(...context.characters.map((c) => `- ${c}`));
  }
  if (context?.settings && context.settings.length > 0) {
    contextLines.push('## 世界観・設定');
    contextLines.push(...context.settings.map((s) => `- ${s}`));
  }
  const contextBlock = contextLines.length > 0 ? contextLines.join('\n') : '（なし）';

  return `あなたはプロの小説ストーリーアーキテクトです。ストーリー構想全体のマークダウン文書を、指示に従って編集・ブラッシュアップしてください。

# 現在のストーリー構想マークダウン
${markdown}

# 編集指示
${instruction}

# 作品コンテキスト（参考）
${contextBlock}

# 指示
1. 指示に従って文書全体を修正・調整してください。
2. マークダウンの見出し構造（# や ##）を適切に維持してください。
3. 指示のない箇所は可能な限り既存の内容を尊重してください。
4. 説明文やコードブロック囲み（\`\`\`markdown ... \`\`\`）は含めず、純粋なマークダウンテキストのみを出力してください。

# 出力形式
編集後のマークダウン文書全体を出力してください。`;
}

/**
 * ストーリー構想マークダウンから全章・節のプロット構成を生成するプロンプト。
 */
export function generatePlotFromStoryOutline(params: {
  novelTitle: string;
  storyOutline: string;
  settings?: string[];
  characters?: string[];
}): string {
  const settings = params.settings?.length
    ? params.settings.map((s) => `- ${s}`).join('\n')
    : '（指定なし）';
  const characters = params.characters?.length
    ? params.characters.map((c) => `- ${c}`).join('\n')
    : '（指定なし）';

  return `あなたはプロの構成作家です。以下のストーリー構想（あらすじ、各フェーズの展開、今後の展開候補、結末）を忠実に反映し、小説全体の章立てプロット（各章のタイトルと詳細な概要）を設計してください。

# 作品情報
- タイトル: ${params.novelTitle}

# ストーリー構想（作家が詰めた設計書）
${params.storyOutline}

# 世界観・設定
${settings}

# 登場人物
${characters}

# 指示
1. ストーリー構想に書かれている導入、中盤の展開、クライマックス、結末の流れをしっかりと各章に分解・配置してください。
2. 物語の規模感・構想の内容に合わせて適切な章数を設計してください（目安: 6〜20章程度）。
3. 各章には魅力的なタイトルと、その章で起こる主要な出来事・感情の動き・伏線の設置/回収を含めた具体的なサマリーを記述してください。
4. 必ず以下の JSON 形式のみで出力してください。

# 出力形式
JSON 形式のみを出力してください（Markdown のコードブロックや余計な文は含めないでください）。
{
  "title": "${params.novelTitle}",
  "description": "ストーリー構想を要約した全体のあらすじ",
  "chapters": [
    {
      "title": "章タイトル",
      "order": 1,
      "summary": "その章で起こる具体的な出来事、人物の動き、感情の推移、伏線など"
    }
  ]
}`;
}
