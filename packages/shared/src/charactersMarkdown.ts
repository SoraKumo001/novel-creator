/**
 * 人物（characters）をマークダウン文書として直列化・解析するユーティリティ。
 *
 * マークダウン構造の規約:
 * - `# カテゴリ`  = 人物のカテゴリ（level 1 見出し）
 * - `## 人物名`  = 人物の名前（level 2 見出し）
 * - 見出し直後の本文 = 人物の description
 * - `### 特徴`   = traits（リスト項目を配列に変換）
 * - `### 関係性` = relationships（テキストとして保持、将来的に構造化可能）
 *
 * コードフェンス（``` ``` ```）内の `#` は見出しとして誤認しないよう、
 * 行スキャン時にフェンス状態を追跡する。
 */

/** マークダウン解析後の人物セクション。 */
export interface ParsedCharacterSection {
  category: string;
  name: string;
  description: string;
  traits: string[];
  relationships: string;
}

/** フォーカストラッキング用のセクション情報（行範囲付き）。 */
export interface CharacterSectionRange {
  category: string;
  name: string;
  /** `##` 見出し行の 0 始まり行番号。 */
  headingLine: number;
  /** 本文開始行（見出しの次行）の 0 始まり行番号。 */
  startLine: number;
  /** 本文終端行（次の見出しの前行、または文書末尾）の 0 始まり行番号（含む）。 */
  endLine: number;
  /** セクション全文（見出し含む）。LLM編集時に送信するテキスト。 */
  fullText: string;
  /** description 部分。 */
  description: string;
  /** traits 配列。 */
  traits: string[];
  /** relationships テキスト。 */
  relationships: string;
}

/** カテゴリごとのツリーノード。 */
export interface CharacterCategoryNode {
  category: string;
  /** カテゴリ見出しの 0 始まり行番号。 */
  headingLine: number;
  children: { name: string; headingLine: number }[];
}

/**
 * 人物リストを単一のマークダウン文書に直列化する。
 *
 * 同一カテゴリの人物は連続して配置し、カテゴリ見出しの重複を避ける。
 * カテゴリ・名前の順で安定ソートする。
 */
export function serializeCharactersToMarkdown(
  characters: {
    category?: string | null;
    name: string;
    description?: string | null;
    traits?: string[] | null;
    relationships?: unknown;
  }[],
): string {
  if (characters.length === 0) return '';

  const sorted = [...characters].sort((a, b) => {
    const ca = (a.category ?? '未分類').trim() || '未分類';
    const cb = (b.category ?? '未分類').trim() || '未分類';
    const c = ca.localeCompare(cb, 'ja');
    return c !== 0 ? c : a.name.localeCompare(b.name, 'ja');
  });

  const lines: string[] = [];
  let currentCategory = '';

  for (const c of sorted) {
    const category = (c.category ?? '未分類').trim() || '未分類';
    if (category !== currentCategory) {
      if (lines.length > 0) lines.push('');
      lines.push(`# ${category}`);
      lines.push('');
      currentCategory = category;
    }
    lines.push(`## ${c.name}`);
    lines.push('');

    const desc = (c.description ?? '').trim();
    if (desc) {
      lines.push(desc);
      lines.push('');
    }

    const traits = c.traits?.filter((t) => t.trim()) ?? [];
    if (traits.length > 0) {
      lines.push('### 特徴');
      lines.push('');
      for (const t of traits) {
        lines.push(`- ${t}`);
      }
      lines.push('');
    }

    const rel = relationshipsToText(c.relationships);
    if (rel) {
      lines.push('### 関係性');
      lines.push('');
      lines.push(rel);
      lines.push('');
    }
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}

/**
 * relationships（jsonb）をテキストに変換する。
 * 文字列ならそのまま、オブジェクト/配列なら JSON 文字列化、未定義なら空。
 */
function relationshipsToText(relationships: unknown): string {
  if (relationships == null) return '';
  if (typeof relationships === 'string') return relationships.trim();
  if (typeof relationships === 'object') {
    try {
      const text = JSON.stringify(relationships, null, 2);
      return text === '{}' ? '' : text;
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * マークダウン文書を解析して人物セクション配列を返す。
 *
 * コードフェンス内の `#` / `##` / `###` は見出しとして扱わない。
 * 同一 (category, name) が複数回出現した場合は最初の出現を採用し、重複分は無視する。
 */
export function parseCharactersMarkdown(markdown: string): ParsedCharacterSection[] {
  const lines = markdown.split('\n');
  const sections: ParsedCharacterSection[] = [];
  const seen = new Set<string>();

  let currentCategory = '';
  let inFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      i++;
      continue;
    }
    if (inFence) {
      i++;
      continue;
    }

    // level 1 見出し = カテゴリ
    const h1 = /^#\s+(.+?)\s*$/.exec(line);
    if (h1) {
      currentCategory = h1[1].trim();
      i++;
      continue;
    }

    // level 2 見出し = 人物名
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      const name = h2[1].trim();
      const key = `${currentCategory}\u0000${name}`;
      if (currentCategory && !seen.has(key)) {
        seen.add(key);
        // セクション全体を収集: 次の `#` or `##` 見出しまたは文書末まで
        const sectionLines: string[] = [];
        let j = i + 1;
        let bodyInFence = false;
        while (j < lines.length) {
          const bodyLine = lines[j];
          if (/^\s*```/.test(bodyLine)) {
            bodyInFence = !bodyInFence;
            sectionLines.push(bodyLine);
            j++;
            continue;
          }
          if (!bodyInFence && /^(#{1,2})\s+/.test(bodyLine)) break;
          sectionLines.push(bodyLine);
          j++;
        }
        const parsed = parseCharacterBody(currentCategory, name, sectionLines);
        sections.push(parsed);
      }
      i++;
      continue;
    }

    i++;
  }

  return sections;
}

/**
 * 人物セクションの本文（`##` 見出し後の行）を解析し、
 * description / traits / relationships に分割する。
 */
function parseCharacterBody(
  category: string,
  name: string,
  bodyLines: string[],
): ParsedCharacterSection {
  let currentSub: 'description' | 'traits' | 'relationships' = 'description';
  const descLines: string[] = [];
  const traitLines: string[] = [];
  const relLines: string[] = [];

  let inFence = false;

  for (const line of bodyLines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      if (currentSub === 'description') descLines.push(line);
      else if (currentSub === 'traits') traitLines.push(line);
      else relLines.push(line);
      continue;
    }
    if (inFence) {
      if (currentSub === 'description') descLines.push(line);
      else if (currentSub === 'traits') traitLines.push(line);
      else relLines.push(line);
      continue;
    }

    // `### 特徴` サブ見出し
    if (/^###\s+特徴\s*$/.test(line)) {
      currentSub = 'traits';
      continue;
    }
    // `### 関係性` サブ見出し
    if (/^###\s+関係性\s*$/.test(line)) {
      currentSub = 'relationships';
      continue;
    }
    // その他の `###` は description 扱い（安全側に倒す）
    if (/^###\s+/.test(line)) {
      if (currentSub === 'description') descLines.push(line);
      continue;
    }

    if (currentSub === 'description') {
      descLines.push(line);
    } else if (currentSub === 'traits') {
      traitLines.push(line);
    } else {
      relLines.push(line);
    }
  }

  // description: 末尾の空行を除去
  while (descLines.length > 0 && descLines[descLines.length - 1].trim() === '') {
    descLines.pop();
  }
  const description = descLines.join('\n');

  // traits: リスト項目（`- ` で始まる行）を抽出
  const traits = traitLines
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter((t) => t.length > 0);

  // relationships: 末尾の空行を除去
  while (relLines.length > 0 && relLines[relLines.length - 1].trim() === '') {
    relLines.pop();
  }
  const relationships = relLines.join('\n');

  return { category, name, description, traits, relationships };
}

/**
 * マークダウン文書からセクションの行範囲情報を抽出する。
 *
 * フォーカストラッキング用: カーソル行を含むセクションを特定するために使う。
 */
export function getCharacterSections(markdown: string): CharacterSectionRange[] {
  const lines = markdown.split('\n');
  const ranges: CharacterSectionRange[] = [];
  let currentCategory = '';
  let inFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      i++;
      continue;
    }
    if (inFence) {
      i++;
      continue;
    }

    // level 1 見出し = カテゴリ
    const h1 = /^#\s+(.+?)\s*$/.exec(line);
    if (h1) {
      currentCategory = h1[1].trim();
      i++;
      continue;
    }

    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      const name = h2[1].trim();
      const headingLine = i;
      const startLine = i + 1;
      // セクション終端を探す
      let endLine = lines.length - 1;
      let j = i + 1;
      let bodyInFence = false;
      const sectionLines: string[] = [];
      while (j < lines.length) {
        const bodyLine = lines[j];
        if (/^\s*```/.test(bodyLine)) {
          bodyInFence = !bodyInFence;
          sectionLines.push(bodyLine);
          j++;
          continue;
        }
        if (!bodyInFence && /^(#{1,2})\s+/.test(bodyLine)) {
          endLine = j - 1;
          break;
        }
        sectionLines.push(bodyLine);
        j++;
      }
      if (j >= lines.length) endLine = lines.length - 1;

      const parsed = parseCharacterBody(currentCategory, name, sectionLines);
      ranges.push({
        category: currentCategory,
        name,
        headingLine,
        startLine,
        endLine: Math.max(endLine, startLine - 1),
        fullText: sectionLines.join('\n'),
        description: parsed.description,
        traits: parsed.traits,
        relationships: parsed.relationships,
      });
      i++;
      continue;
    }

    i++;
  }

  return ranges;
}

/**
 * マークダウン文書からカテゴリツリーを構築する。
 *
 * ツリー表示用: カテゴリ → 人物名の階層。
 */
export function buildCharacterTree(markdown: string): CharacterCategoryNode[] {
  const lines = markdown.split('\n');
  const tree: CharacterCategoryNode[] = [];
  let currentCategory: CharacterCategoryNode | null = null;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const h1 = /^#\s+(.+?)\s*$/.exec(line);
    if (h1) {
      currentCategory = { category: h1[1].trim(), headingLine: i, children: [] };
      tree.push(currentCategory);
      continue;
    }

    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2 && currentCategory) {
      currentCategory.children.push({ name: h2[1].trim(), headingLine: i });
    }
  }

  return tree;
}

/**
 * 指定行番号を含むセクションを返す。
 *
 * フォーカス連動用: Monaco のカーソル位置からアクティブセクションを特定する。
 */
export function findCharacterAtLine(
  markdown: string,
  lineNumber: number,
): CharacterSectionRange | null {
  const sections = getCharacterSections(markdown);
  for (const s of sections) {
    if (lineNumber >= s.headingLine && lineNumber <= s.endLine) {
      return s;
    }
  }
  return null;
}

/**
 * 保存時の差分を計算する。
 *
 * 既存人物と解析結果を (category, name) で突き合わせ、
 * 追加・更新・削除すべき人物を分類する。
 */
export interface CharactersDiff {
  /** 新規作成すべき人物。 */
  toCreate: ParsedCharacterSection[];
  /** 更新すべき人物（description/traits/relationships のいずれかが変化したもの）。 */
  toUpdate: {
    id: string;
    category: string;
    name: string;
    description: string;
    traits: string[];
    relationships: string;
  }[];
  /** 削除すべき人物の id。 */
  toDelete: string[];
  /** 同一 (category, name) で重複出現した件数。 */
  duplicateCount: number;
}

export function diffCharacters(
  existing: {
    id: string;
    category?: string | null;
    name: string;
    description?: string | null;
    traits?: string[] | null;
    relationships?: unknown;
  }[],
  parsed: ParsedCharacterSection[],
): CharactersDiff {
  const existingMap = new Map<string, (typeof existing)[number]>();
  for (const e of existing) {
    const cat = (e.category ?? '未分類').trim() || '未分類';
    existingMap.set(`${cat}\u0000${e.name}`, e);
  }

  const parsedMap = new Map<string, ParsedCharacterSection>();
  let duplicateCount = 0;
  for (const p of parsed) {
    const key = `${p.category}\u0000${p.name}`;
    if (parsedMap.has(key)) {
      duplicateCount++;
      continue;
    }
    parsedMap.set(key, p);
  }

  const toCreate: ParsedCharacterSection[] = [];
  const toUpdate: CharactersDiff['toUpdate'] = [];

  for (const [key, p] of parsedMap) {
    const ex = existingMap.get(key);
    if (!ex) {
      toCreate.push(p);
    } else {
      const exDesc = (ex.description ?? '').trim();
      const newDesc = p.description.trim();
      const exTraits = (ex.traits ?? []).slice().sort().join('\n');
      const newTraits = p.traits.slice().sort().join('\n');
      const exRel = relationshipsToText(ex.relationships);
      const newRel = p.relationships.trim();
      if (exDesc !== newDesc || exTraits !== newTraits || exRel !== newRel) {
        toUpdate.push({
          id: ex.id,
          category: p.category,
          name: p.name,
          description: p.description,
          traits: p.traits,
          relationships: p.relationships,
        });
      }
    }
  }

  const toDelete: string[] = [];
  for (const [key, ex] of existingMap) {
    if (!parsedMap.has(key)) {
      toDelete.push(ex.id);
    }
  }

  return { toCreate, toUpdate, toDelete, duplicateCount };
}
