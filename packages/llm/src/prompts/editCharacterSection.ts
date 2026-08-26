/**
 * 人物マークダウンの単一セクションを LLM で編集するプロンプト。
 * 出力はプレーンなマークダウン本文（`##` 見出し行を含まない）。
 */
export function editCharacterSection(
  section: {
    category: string;
    name: string;
    description: string;
    traits: string[];
    relationships: string;
  },
  instruction: string,
  context?: { settings: string[]; characters: string[] },
): string {
  const description = section.description.trim() || '（未設定）';
  const traits = section.traits.length
    ? section.traits.map((t) => `- ${t}`).join('\n')
    : '（未設定）';
  const relationships = section.relationships.trim() || '（未設定）';

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

  return `あなたは小説の登場人物を管理する編集者です。以下の人物セクションを、指示に従って編集してください。

# 対象セクション
- カテゴリ: ${section.category}
- 名前: ${section.name}
- 本文:
${description}

# 特徴・性格
${traits}

# 関係性
${relationships}

# 編集指示
${instruction}

# 関連情報（一貫性のための参考）
${contextBlock}

# 指示
1. 編集指示に忠実に従い、セクション本文を編集してください。
2. マークダウンの書式（リスト、太字、コードブロックなど）を維持してください。
3. \`### 特徴\` / \`### 関係性\` のサブセクション構造を維持してください。
4. 指示にない部分は、可能な限り既存の本文をそのまま維持してください。
5. 関連する設定・人物と矛盾しないように、一貫性を保ってください。

# 出力形式
編集後のセクション本文のみを、マークダウン形式で出力してください。
- \`##\` 見出し行は含めないでください。
- \`### 特徴\` / \`### 関係性\` のサブセクションは維持してください。
- JSON や説明文は含めないでください。
- 本文のマークダウンのみを出力してください。`;
}
