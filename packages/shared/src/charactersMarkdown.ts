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
  serializeCategoryDocument,
  sortEntitiesByCategory,
} from "./categoryTree.js";
import {
  buildDeleteSet,
  buildMarkdownCategoryTree,
  calculateEntityDiff,
  findSectionByLine,
  formatEntityMarkdown,
  type MarkdownCategoryNode,
  mergeEntitiesByKey,
  normalizeCategory as normalizeCategoryName,
  parseEntitySections,
  scanEntityRanges,
  trimAndJoinLines,
} from "./markdownCore.js";

/** マークダウン解析後の人物セクション。 */
export interface ParsedCharacterSection {
  category: string;
  description: string;
  name: string;
  relationships: string;
  traits: string[];
}

/** フォーカストラッキング用のセクション情報（行範囲付き）。 */
export interface CharacterSectionRange {
  category: string;
  /** description 部分。 */
  description: string;
  /** 本文終端行（次の見出しの前行、または文書末尾）の 0 始まり行番号（含む）。 */
  endLine: number;
  /** セクション全文（見出し含む）。LLM編集時に送信するテキスト。 */
  fullText: string;
  /** `##` 見出し行の 0 始まり行番号。 */
  headingLine: number;
  name: string;
  /** relationships テキスト。 */
  relationships: string;
  /** 本文開始行（見出しの次行）の 0 始まり行番号。 */
  startLine: number;
  /** traits 配列。 */
  traits: string[];
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
  }[]
): string {
  if (characters.length === 0) {
    return "";
  }

  const sorted = sortEntitiesByCategory(
    characters,
    (c) => normalizeCategoryName(c.category, "未分類"),
    (c) => c.name
  );

  return serializeCategoryDocument(sorted, {
    categoryOf: (c) => normalizeCategoryName(c.category, "未分類"),
    nameOf: (c) => c.name,
    writeBody: (c, lines) => {
      lines.push("");

      const desc = (c.description ?? "").trim();
      if (desc) {
        lines.push(desc);
        lines.push("");
      }

      const traits = c.traits?.filter((t) => t.trim()) ?? [];
      if (traits.length > 0) {
        lines.push("### 特徴");
        lines.push("");
        for (const t of traits) {
          lines.push(`- ${t}`);
        }
        lines.push("");
      }

      const rel = relationshipsToText(c.relationships);
      if (rel) {
        lines.push("### 関係性");
        lines.push("");
        lines.push(rel);
        lines.push("");
      }
    },
  });
}

/**
 * relationships（jsonb）をテキストに変換する。
 * 文字列ならそのまま、オブジェクト/配列なら JSON 文字列化、未定義なら空。
 */
function relationshipsToText(relationships: unknown): string {
  if (relationships == null) {
    return "";
  }
  if (typeof relationships === "string") {
    return relationships.trim();
  }
  if (typeof relationships === "object") {
    try {
      const text = JSON.stringify(relationships, null, 2);
      return text === "{}" ? "" : text;
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * 人物セクションの本文（`##` 見出し後の行）を解析し、
 * description / traits / relationships に分割する。
 */
function parseCharacterBody(
  category: string,
  name: string,
  bodyLines: string[]
): ParsedCharacterSection {
  let currentSub: "description" | "traits" | "relationships" = "description";
  const descLines: string[] = [];
  const traitLines: string[] = [];
  const relLines: string[] = [];

  let inFence = false;

  for (const line of bodyLines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      if (currentSub === "description") {
        descLines.push(line);
      } else if (currentSub === "traits") {
        traitLines.push(line);
      } else {
        relLines.push(line);
      }
      continue;
    }
    if (inFence) {
      if (currentSub === "description") {
        descLines.push(line);
      } else if (currentSub === "traits") {
        traitLines.push(line);
      } else {
        relLines.push(line);
      }
      continue;
    }

    // `### 特徴` サブ見出し
    if (/^###\s+特徴\s*$/.test(line)) {
      currentSub = "traits";
      continue;
    }
    // `### 関係性` サブ見出し
    if (/^###\s+関係性\s*$/.test(line)) {
      currentSub = "relationships";
      continue;
    }
    // その他の `###` は description 扱い（安全側に倒す）
    if (/^###\s+/.test(line)) {
      if (currentSub === "description") {
        descLines.push(line);
      }
      continue;
    }

    if (currentSub === "description") {
      descLines.push(line);
    } else if (currentSub === "traits") {
      traitLines.push(line);
    } else {
      relLines.push(line);
    }
  }

  // traits: リスト項目（`- ` または `* ` で始まる行）を抽出
  const traits = traitLines
    .map((l) => l.replace(/^\s*[-*]\s+/, "").trim())
    .filter((t) => t.length > 0);

  return {
    category,
    description: trimAndJoinLines(descLines),
    name,
    relationships: trimAndJoinLines(relLines),
    traits,
  };
}

/**
 * マークダウン文書を解析して人物セクション配列を返す。
 */
export function parseCharactersMarkdown(
  markdown: string
): ParsedCharacterSection[] {
  return parseEntitySections(markdown, (raw) =>
    parseCharacterBody(raw.category, raw.name, raw.bodyLines)
  );
}

/**
 * マークダウン文書からセクションの行範囲情報を抽出する。
 *
 * フォーカストラッキング用: カーソル行を含むセクションを特定するために使う。
 */
export function getCharacterSections(
  markdown: string
): CharacterSectionRange[] {
  return scanEntityRanges(markdown, (raw) => {
    const parsed = parseCharacterBody(raw.category, raw.name, raw.bodyLines);
    return {
      category: raw.category,
      description: parsed.description,
      endLine: raw.endLine,
      fullText: raw.bodyLines.join("\n"),
      headingLine: raw.headingLine,
      name: raw.name,
      relationships: parsed.relationships,
      startLine: raw.startLine,
      traits: parsed.traits,
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
  lineNumber: number
): CharacterSectionRange | null {
  const sections = getCharacterSections(markdown);
  return findSectionByLine(sections, lineNumber);
}

/**
 * 保存時の差分を計算する。
 */
export interface CharactersDiff {
  /** 同一 (category, name) で重複出現した件数。 */
  duplicateCount: number;
  /** 新規作成すべき人物。 */
  toCreate: ParsedCharacterSection[];
  /** 削除すべき人物の id。 */
  toDelete: string[];
  /** 更新すべき人物（description/traits/relationships のいずれかが変化したもの）。 */
  toUpdate: {
    id: string;
    category: string;
    name: string;
    description: string;
    traits: string[];
    relationships: string;
  }[];
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
  parsed: ParsedCharacterSection[]
): CharactersDiff {
  return calculateEntityDiff(
    existing,
    parsed,
    (ex, p) => {
      const exDesc = (ex.description ?? "").trim();
      const newDesc = p.description.trim();
      const exTraits = (ex.traits ?? []).join(",");
      const newTraits = p.traits.join(",");
      const exRel = relationshipsToText(ex.relationships);
      const newRel = p.relationships.trim();
      return exDesc !== newDesc || exTraits !== newTraits || exRel !== newRel;
    },
    (ex, p) => ({
      category: p.category,
      description: p.description,
      id: ex.id,
      name: p.name,
      relationships: p.relationships,
      traits: p.traits,
    })
  );
}

/**
 * 現在の人物マークダウンに対し、新しい人物リストを追加または更新し、指定された古い人物を削除したマークダウンを生成する。
 */
export function applyCharactersToMarkdown(
  currentMarkdown: string,
  newCharacters: {
    category?: string | null;
    name: string;
    description?: string | null;
    traits?: string[] | null;
    relationships?: string | null;
  }[],
  deleteNames?: string[]
): string {
  const existing = parseCharactersMarkdown(currentMarkdown);
  const merged = mergeEntitiesByKey(existing, newCharacters, {
    deleteKeys: buildDeleteSet(deleteNames),
    keyOfNew: (nc) => {
      const rawName =
        nc.name ??
        (nc as { title?: string }).title ??
        (nc.description ? nc.description.slice(0, 30) : "") ??
        "無題の登場人物";
      return typeof rawName === "string" && rawName.trim()
        ? rawName.trim()
        : "無題の登場人物";
    },
    keyOfParsed: (c) => (typeof c.name === "string" ? c.name.trim() : ""),
    merge: (prev, nc, trimmed) => ({
      category: nc.category || prev?.category || "未分類",
      description: nc.description ?? prev?.description ?? "",
      name: trimmed,
      relationships: nc.relationships ?? prev?.relationships ?? "",
      traits: nc.traits ?? prev?.traits ?? [],
    }),
  });
  return serializeCharactersToMarkdown(merged);
}

/**
 * 現在の人物マークダウンから、指定された人物名を削除したマークダウンを生成する。
 */
export function deleteCharactersFromMarkdown(
  currentMarkdown: string,
  deleteNames: string[]
): string {
  return applyCharactersToMarkdown(currentMarkdown, [], deleteNames);
}

/**
 * 人物マークダウンをパースし、正規化・ソートして改行や空行を適切に整形（フォーマット）したマークダウンを返す。
 */
export function formatCharactersMarkdown(markdown: string): string {
  return formatEntityMarkdown(
    markdown,
    parseCharactersMarkdown,
    serializeCharactersToMarkdown
  );
}
