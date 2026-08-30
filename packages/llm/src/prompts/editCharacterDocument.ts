/**
 * 人物マークダウン文書全体を LLM で編集するプロンプト。
 * 出力は編集後のマークダウン文書全体。
 */
export function editCharacterDocument(
  document: string,
  instruction: string,
  context?: { settings: string[]; characters: string[] },
): string {
  const contextLines: string[] = [];
  if (context?.settings && context.settings.length > 0) {
    contextLines.push('## 関連する設定');
    contextLines.push(...context.settings.map((s) => `- ${s}`));
  }
  if (context?.characters && context.characters.length > 0) {
    contextLines.push('## 関連する人物');
    contextLines.push(...context.characters.map((c) => `- ${c}`));
  }
  const contextBlock = contextLines.length > 0 ? contextLines.join('\n') : '（なし）';

  return `あなたは小説の登場人物を管理する編集者です。以下の人物マークダウン文書全体を、指示に従って編集してください。

# 対象文書
${document}

# 編集指示
${instruction}

# 関連情報（一貫性のための参考）
${contextBlock}

# 指示
1. 編集指示に忠実に従い、文書全体を編集してください。
2. \`# カテゴリ\` / \`## 名前\` の見出し構造を必ず維持してください。
   - カテゴリはスラッシュ（\`/\`）で区切ることで階層化できます（例: \`# 採取ギルド / 幹部 / ギルド長\`、\`# 騎士団 / 団長\`、\`# 主要人物\`）。カテゴリの再編成や細分化の指示がある場合は、スラッシュ記法で階層構造を表現してください。
3. \`### 特徴\` / \`### 関係性\` のサブセクション構造を維持してください。
4. マークダウンの書式（リスト、太字、コードブロックなど）を維持してください。
5. 指示にない部分は、可能な限り既存の内容をそのまま維持してください。
6. 関連する設定・人物と矛盾しないように、一貫性を保ってください。

# 出力形式
編集後のマークダウン文書全体を出力してください。
- \`# カテゴリ\`（スラッシュ階層可） / \`## 名前\` の見出し構造をすべて含めてください。
- \`### 特徴\` / \`### 関係性\` のサブセクションは維持してください。
- JSON や説明文は含めないでください。
- マークダウンのみを出力してください。`;
}
