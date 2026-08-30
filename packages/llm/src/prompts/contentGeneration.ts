/**
 * 本文を生成するプロンプト。前の文脈、登場人物、設定を考慮する。
 */
export function contentGeneration(
  section: { title?: string; summary: string },
  context: {
    previousContent?: string;
    characters?: string[];
    settings?: string[];
  },
): string {
  const sectionTitle = section.title ?? '（未設定）';
  const previousContent = context.previousContent ? context.previousContent : '（前の文脈なし）';
  const characters = context.characters?.length
    ? context.characters.map((c) => `- ${c}`).join('\n')
    : '（指定なし）';
  const settings = context.settings?.length
    ? context.settings.map((s) => `- ${s}`).join('\n')
    : '（指定なし）';

  return `あなたはプロの小説家です。以下の節の概要に基づいて、小説の本文を生成してください。

# 節情報
- 節タイトル: ${sectionTitle}
- 節の概要: ${section.summary}

# 前の文脈
${previousContent}

# 登場人物
${characters}

# 世界観・設定
${settings}

# 指示
1. 節の概要に忠実に従い、自然で読みやすい日本語の小説本文を生成してください。
2. 前の文脈と矛盾しないように、登場人物の言動や設定を一貫させてください。
3. 地の文・会話・心理描写をバランスよく織り交ぜてください。
4. 節の冒頭は前の文脈から自然に続くようにしてください。
5. 節の結末は次の節へつながるように、適度に余韻を残してください。
6. 日本の小説作法に準拠してください:
   - 三点リーダー（……）やダッシュ（――）は2マス分（2連）で使用してください。
   - ルビを振る場合は \`｜親文字《るび》\` 形式、傍点（圏点）を振る場合は \`《《強調文字》》\` 形式を使用してください。
   - 会話文は「」を用い、会話文の末尾には句点（。）を付けないのが標準的です。
7. 本文のみを出力してください。見出しや注釈、JSON は含めないでください。`;
}
