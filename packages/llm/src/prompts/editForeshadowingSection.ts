/**
 * 伏線マークダウンの単一セクションを LLM で編集するプロンプト。
 * 出力はプレーンなマークダウン本文（`##` 見出し行を含まない）。
 */
export function editForeshadowingSection(
  section: { category: string; title: string; description: string; status?: string },
  instruction: string,
  context?: { settings: string[]; characters: string[]; plot?: string[] },
): string {
  const description = section.description.trim() || '（未設定）';
  const status = section.status ?? 'unresolved';

  const contextLines: string[] = [];
  if (context?.settings && context.settings.length > 0) {
    contextLines.push('## 関連する設定');
    contextLines.push(...context.settings.map((s) => `- ${s}`));
  }
  if (context?.characters && context.characters.length > 0) {
    contextLines.push('## 関連する人物');
    contextLines.push(...context.characters.map((c) => `- ${c}`));
  }
  if (context?.plot && context.plot.length > 0) {
    contextLines.push('## プロット・あらすじ');
    contextLines.push(...context.plot.map((p) => `- ${p}`));
  }
  const contextBlock = contextLines.length > 0 ? contextLines.join('\n') : '（なし）';

  return `あなたは小説の伏線・構成を管理する編集者です。以下の伏線セクションを、指示に従って編集してください。

# 対象セクション
- カテゴリ: ${section.category}
- 伏線タイトル: ${section.title}
- ステータス: ${status}
- 詳細メモ:
${description}

# 編集指示
${instruction}

# 関連情報（一貫性のための参考）
${contextBlock}

# 指示
1. 編集指示に忠実に従い、セクション本文（詳細メモ）を編集してください。
2. マークダウンの書式（リスト、太字、コードブロックなど）を維持してください。
3. 指示にない部分は、可能な限り既存の本文をそのまま維持してください。
4. 関連する設定・人物・プロットと矛盾しないように、一貫性を保ってください。

# 出力形式
編集後のセクション本文のみを、マークダウン形式で出力してください。
- \`##\` 見出し行は含めないでください。
- JSON や説明文は含めないでください。
- 本文のマークダウンのみを出力してください。`;
}
