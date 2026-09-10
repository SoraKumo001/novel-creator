/**
 * 本文を生成するプロンプト。前の文脈、章情報、登場人物、設定を考慮する。
 */
export function contentGeneration(
  section: { title?: string; summary: string },
  context: {
    chapter?: { summary?: string | null; title?: string };
    characters?: string[];
    previousContent?: string;
    settings?: string[];
    styleGuide?: string | null;
  }
): string {
  const sectionTitle = section.title ?? "（未設定）";
  const previousContent = context.previousContent
    ? context.previousContent
    : "（前の文脈なし）";
  const characters = context.characters?.length
    ? context.characters.map((c) => `- ${c}`).join("\n")
    : "（指定なし）";
  const settings = context.settings?.length
    ? context.settings.map((s) => `- ${s}`).join("\n")
    : "（指定なし）";
  const styleGuideSection = context.styleGuide?.trim()
    ? `\n# 執筆スタイル・文体ガイドライン\n${context.styleGuide.trim()}\n`
    : "";

  const chapterSection = context.chapter
    ? `# 章情報\n- 章タイトル: ${context.chapter.title ?? "（未設定）"}${
        context.chapter.summary?.trim()
          ? `\n- 章の概要: ${context.chapter.summary.trim()}`
          : ""
      }\n\n`
    : "";

  return `あなたはプロの小説家です。以下の節の概要に基づいて、小説の本文を生成してください。

${chapterSection}# 節情報
- 節タイトル: ${sectionTitle}
- 節の概要: ${section.summary}

# 前の文脈
${previousContent}

# 登場人物
${characters}

# 世界観・設定
${settings}
${styleGuideSection}
# 指示
1. 節の概要に忠実に従いつつ、あらすじの事象を性急に箇条書きのように消化せず、一編の小説シーンとして豊かに肉付けしてください。
2. 読者への状況共有（セットアップの徹底）:
   - 節の冒頭や場面転換では、いきなり核心の行動や会話から入るのではなく、現在地・時間帯・周囲の様子・誰がどのような状況や体勢にいるのかを、五感描写（情景、光、音、気温、空気感など）を交えて丁寧に描写し、読者が情景を自然に思い浮かべられるようにしてください。
3. 読者の理解度を意識した情報開示:
   - 設定知識や過去の経緯、特殊な固有名詞を読者が最初から知っているものとして前提化しないでください。読者がまだ知らない情報は、キャラクターの自然な思考・会話・仕草・身体反応を通じて、無理なく理解できるように文脈の中で開示してください。
4. 心情と動機の丁寧な描写（Show, Don't Tell）:
   - なぜその発言や行動に至ったのか、登場人物の内面（思考、迷い、感情の機微、視線の動き、息遣い）を地の文に描き、読者がキャラクターに共感・納得できるようにしてください。
5. ペーシング（緩急と間）:
   - セリフの応酬だけで急展開させず、セリフとセリフの間に適切な仕草や沈黙、周囲の反応を挟み、読者が展開を追える自然なテンポで執筆してください。
6. 前の文脈と矛盾しないように、登場人物の言動や設定を一貫させ、節の冒頭は前の文脈から自然に続くようにしてください。
7. 節の結末は次の節へつながるように、適度に余韻を残してください。
8. ${
    context.styleGuide?.trim()
      ? "上記の「執筆スタイル・文体ガイドライン」（視点、人称、文体トーン、作法、禁止事項等）を最優先で厳格に遵守してください。"
      : "地の文・会話・心理描写をバランスよく織り交ぜてください。"
  }
9. 日本の小説作法に準拠してください:
   - 三点リーダー（……）やダッシュ（――）は2マス分（2連）で使用してください。
   - ルビを振る場合は \`｜親文字《るび》\` 形式、傍点（圏点）を振る場合は \`《《強調文字》》\` 形式を使用してください。
   - 会話文は「」を用い、会話文の末尾には句点（。）を付けないのが標準的です。
10. 本文のみを出力してください。見出しや注釈、JSON は含めないでください。`;
}
