/**
 * 人物（characters）をマークダウン文書として直列化・解析するユーティリティ。
 *
 * マークダウン構造の規約:
 * - `# カテゴリ`  = 人物のカテゴリ（level 1 見出し）
 * - `## 人物名`  = 人物の名前（level 2 見出し）
 * - 見出し直後の本文 = 人物の description
 * - `### 特徴`   = traits（リスト項目を配列に変換）
 * - `### 関係性` = relationships（テキストとして保持）
 */

import {
  buildMarkdownCategoryTree,
  calculateEntityDiff,
  findSectionByLine,
  scanMarkdownSections,
  trimAndJoinLines,
  type MarkdownCategoryNode,
} from './markdownCore.js';

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
export type CharacterCategoryNode = MarkdownCategoryNode;

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

  // traits: リスト項目（`- ` または `* ` で始まる行）を抽出
  const traits = traitLines
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter((t) => t.length > 0);

  return {
    category,
    name,
    description: trimAndJoinLines(descLines),
    traits,
    relationships: trimAndJoinLines(relLines),
  };
}

/**
 * マークダウン文書を解析して人物セクション配列を返す。
 */
export function parseCharactersMarkdown(markdown: string): ParsedCharacterSection[] {
  const rawSections = scanMarkdownSections(markdown);
  const sections: ParsedCharacterSection[] = [];
  const seen = new Set<string>();

  for (const raw of rawSections) {
    const key = `${raw.category}\u0000${raw.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      sections.push(parseCharacterBody(raw.category, raw.name, raw.bodyLines));
    }
  }

  return sections;
}

/**
 * マークダウン文書からセクションの行範囲情報を抽出する。
 *
 * フォーカストラッキング用: カーソル行を含むセクションを特定するために使う。
 */
export function getCharacterSections(markdown: string): CharacterSectionRange[] {
  const rawSections = scanMarkdownSections(markdown);
  return rawSections.map((raw) => {
    const parsed = parseCharacterBody(raw.category, raw.name, raw.bodyLines);
    return {
      category: raw.category,
      name: raw.name,
      headingLine: raw.headingLine,
      startLine: raw.startLine,
      endLine: raw.endLine,
      fullText: raw.bodyLines.join('\n'),
      description: parsed.description,
      traits: parsed.traits,
      relationships: parsed.relationships,
    };
  });
}

/**
 * マークダウン文書からカテゴリツリーを構築する。
 */
export function buildCharacterTree(markdown: string): CharacterCategoryNode[] {
  return buildMarkdownCategoryTree(markdown);
}

/**
 * 指定行番号を含むセクションを返す。
 */
export function findCharacterAtLine(
  markdown: string,
  lineNumber: number,
): CharacterSectionRange | null {
  const sections = getCharacterSections(markdown);
  return findSectionByLine(sections, lineNumber);
}

/**
 * 保存時の差分を計算する。
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
  return calculateEntityDiff(
    existing,
    parsed,
    (ex, p) => {
      const exDesc = (ex.description ?? '').trim();
      const newDesc = p.description.trim();
      const exTraits = (ex.traits ?? []).join(',');
      const newTraits = p.traits.join(',');
      const exRel = relationshipsToText(ex.relationships);
      const newRel = p.relationships.trim();
      return exDesc !== newDesc || exTraits !== newTraits || exRel !== newRel;
    },
    (ex, p) => ({
      id: ex.id,
      category: p.category,
      name: p.name,
      description: p.description,
      traits: p.traits,
      relationships: p.relationships,
    }),
  );
}
