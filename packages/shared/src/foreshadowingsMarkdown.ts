/**
 * 伏線（foreshadowings）をマークダウン文書として直列化・解析するユーティリティ。
 *
 * マークダウン構造の規約:
 * - `# カテゴリ`  = 伏線のカテゴリ（level 1 見出し）
 * - `## タイトル` = 伏線のタイトル（level 2 見出し）
 * - `<!-- status: unresolved -->` = 状態メタデータ（任意）
 * - 見出し（およびメタデータ）に続く本文 = 伏線の詳細メモ（description）
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
  isMetaCommentLine,
  joinCleanBody,
  type MarkdownCategoryNode,
  mergeEntitiesByKey,
  normalizeCategory,
  parseEntitySections,
  parseMetaPairs,
  type RawMarkdownSection,
  scanEntityRanges,
} from "./markdownCore.js";
import type { ForeshadowingStatus } from "./schemas/entities.js";

/** マークダウン解析後の伏線セクション。 */
export interface ParsedForeshadowingSection {
  category: string;
  description: string;
  placedSectionId?: string | null;
  resolvedSectionId?: string | null;
  status: ForeshadowingStatus;
  title: string;
}

/** フォーカストラッキング用のセクション情報（行範囲付き）。 */
export interface ForeshadowingSectionRange {
  category: string;
  /** セクション本文。 */
  description: string;
  /** 本文終端行（次の見出しの前行、または文書末尾）の 0 始まり行番号（含む）。 */
  endLine: number;
  /** `##` 見出し行の 0 始まり行番号。 */
  headingLine: number;
  name: string;
  placedSectionId?: string | null;
  resolvedSectionId?: string | null;
  /** 本文開始行（見出しの次行）の 0 始まり行番号。 */
  startLine: number;
  status: ForeshadowingStatus;
  title: string;
}

/** カテゴリごとのツリーノード。 */
export type ForeshadowingCategoryNode = MarkdownCategoryNode;

/**
 * 伏線リストを単一のマークダウン文書に直列化する。
 */
export function serializeForeshadowingsToMarkdown(
  items: {
    category?: string | null;
    title: string;
    description?: string | null;
    status?: ForeshadowingStatus | null;
    placedSectionId?: string | null;
    resolvedSectionId?: string | null;
  }[]
): string {
  if (items.length === 0) {
    return "";
  }

  const normalized = items.map((f) => {
    const rawTitle =
      f.title ??
      (f as { name?: string }).name ??
      (f.description ? f.description.slice(0, 30) : "") ??
      "無題の伏線";
    return {
      category: (f.category ?? "").trim() || "未分類",
      description: (f.description ?? "").trim(),
      placedSectionId: f.placedSectionId ?? null,
      resolvedSectionId: f.resolvedSectionId ?? null,
      status: f.status ?? "unresolved",
      title:
        typeof rawTitle === "string" && rawTitle.trim()
          ? rawTitle.trim()
          : "無題の伏線",
    };
  });

  const sorted = sortEntitiesByCategory(
    normalized,
    (f) => f.category,
    (f) => f.title
  );

  return serializeCategoryDocument(sorted, {
    categoryOf: (item) => item.category,
    nameOf: (item) => item.title,
    writeBody: (item, lines) => {
      // ステータス等のメタ情報を HTML コメントとして付与
      const metaParts: string[] = [`status: ${item.status}`];
      if (item.placedSectionId) {
        metaParts.push(`placed: ${item.placedSectionId}`);
      }
      if (item.resolvedSectionId) {
        metaParts.push(`resolved: ${item.resolvedSectionId}`);
      }
      lines.push(`<!-- ${metaParts.join(", ")} -->`);
      lines.push("");

      if (item.description) {
        lines.push(item.description);
      }
      lines.push("");
    },
  });
}

/**
 * メタデータコメント行（<!-- status: unresolved ... -->）をパースする。
 */
function parseMetaComment(line: string): {
  status?: ForeshadowingStatus;
  placedSectionId?: string;
  resolvedSectionId?: string;
} {
  const pairs = parseMetaPairs(line);
  const result: {
    status?: ForeshadowingStatus;
    placedSectionId?: string;
    resolvedSectionId?: string;
  } = {};

  const statusRaw = pairs["status"];
  if (
    statusRaw === "resolved" ||
    statusRaw === "abandoned" ||
    statusRaw === "unresolved"
  ) {
    result.status = statusRaw;
  }
  if (pairs["placed"]) {
    result.placedSectionId = pairs["placed"];
  }
  if (pairs["resolved"]) {
    result.resolvedSectionId = pairs["resolved"];
  }

  return result;
}

/**
 * 伏線セクション本文をメタコメントとクリーンな本文に分離するスキーマ宣言。
 */
function splitForeshadowingBody(raw: RawMarkdownSection): {
  description: string;
  placedSectionId: string | null;
  resolvedSectionId: string | null;
  status: ForeshadowingStatus;
} {
  let status: ForeshadowingStatus = "unresolved";
  let placedSectionId: string | null = null;
  let resolvedSectionId: string | null = null;
  const bodyLines: string[] = [];

  for (const line of raw.bodyLines) {
    if (isMetaCommentLine(line)) {
      const meta = parseMetaComment(line);
      if (meta.status) {
        status = meta.status;
      }
      if (meta.placedSectionId !== undefined) {
        placedSectionId = meta.placedSectionId;
      }
      if (meta.resolvedSectionId !== undefined) {
        resolvedSectionId = meta.resolvedSectionId;
      }
    } else {
      bodyLines.push(line);
    }
  }

  return {
    description: joinCleanBody(bodyLines),
    placedSectionId,
    resolvedSectionId,
    status,
  };
}

/**
 * マークダウン文書を解析して伏線セクション配列を返す。
 */
export function parseForeshadowingsMarkdown(
  markdown: string
): ParsedForeshadowingSection[] {
  return parseEntitySections(markdown, (raw) => {
    const body = splitForeshadowingBody(raw);
    return {
      category: raw.category,
      description: body.description,
      placedSectionId: body.placedSectionId,
      resolvedSectionId: body.resolvedSectionId,
      status: body.status,
      title: raw.name,
    };
  });
}

/**
 * マークダウン文書を走査し、行範囲情報を含むセクション配列を返す。
 */
export function scanForeshadowingSectionRanges(
  markdown: string
): ForeshadowingSectionRange[] {
  return scanEntityRanges(markdown, (raw) => {
    const body = splitForeshadowingBody(raw);
    return {
      category: raw.category,
      description: body.description,
      endLine: raw.endLine,
      headingLine: raw.headingLine,
      name: raw.name,
      placedSectionId: body.placedSectionId,
      resolvedSectionId: body.resolvedSectionId,
      startLine: raw.startLine,
      status: body.status,
      title: raw.name,
    };
  });
}

/**
 * カーソル位置（0 始まり行番号）から所属する伏線セクションを特定する。
 */
export function findForeshadowingSectionByLine(
  markdown: string,
  lineNumber: number
): ForeshadowingSectionRange | null {
  const ranges = scanForeshadowingSectionRanges(markdown);
  return findSectionByLine(ranges, lineNumber);
}

/**
 * マークダウンからカテゴリ構造ツリーを構築する。
 */
export function buildForeshadowingCategoryTree(
  markdown: string
): ForeshadowingCategoryNode[] {
  return buildMarkdownCategoryTree(markdown);
}

/**
 * 既存の伏線レコードとパース済みセクションを比較し、
 * 作成・更新・削除の差分を算出する。
 */
export interface ForeshadowingsDiff {
  /** 同一 (category, title) で重複出現した件数。 */
  duplicateCount: number;
  /** 新規作成すべき伏線。 */
  toCreate: ParsedForeshadowingSection[];
  /** 削除すべき伏線の id。 */
  toDelete: string[];
  /** 更新すべき伏線。 */
  toUpdate: {
    id: string;
    category: string;
    title: string;
    description: string;
    status: ForeshadowingStatus;
    placedSectionId: string | null;
    resolvedSectionId: string | null;
  }[];
}

export function diffForeshadowings(
  existingItems: {
    id: string;
    category?: string | null;
    title: string;
    description?: string | null;
    status?: ForeshadowingStatus | null;
    placedSectionId?: string | null;
    resolvedSectionId?: string | null;
  }[],
  parsedSections: ParsedForeshadowingSection[]
): ForeshadowingsDiff {
  const normalizedExisting = existingItems.map((f) => ({
    category: (f.category ?? "").trim() || "未分類",
    description: f.description ?? "",
    id: f.id,
    name: f.title,
    placedSectionId: f.placedSectionId ?? null,
    resolvedSectionId: f.resolvedSectionId ?? null,
    status: f.status ?? "unresolved",
  }));

  const normalizedParsed = parsedSections.map((s) => ({
    category: s.category.trim() || "未分類",
    description: s.description,
    name: s.title,
    placedSectionId: s.placedSectionId ?? null,
    resolvedSectionId: s.resolvedSectionId ?? null,
    status: s.status,
  }));

  const diffResult = calculateEntityDiff(
    normalizedExisting,
    normalizedParsed,
    (a, b) =>
      a.description.trim() !== b.description.trim() ||
      a.status !== b.status ||
      a.placedSectionId !== b.placedSectionId ||
      a.resolvedSectionId !== b.resolvedSectionId,
    (ex, p) => ({
      category: p.category,
      description: p.description,
      id: ex.id,
      placedSectionId: p.placedSectionId,
      resolvedSectionId: p.resolvedSectionId,
      status: p.status,
      title: p.name,
    })
  );

  return {
    duplicateCount: diffResult.duplicateCount,
    toCreate: diffResult.toCreate.map((c) => ({
      category: c.category,
      description: c.description,
      placedSectionId: c.placedSectionId,
      resolvedSectionId: c.resolvedSectionId,
      status: c.status,
      title: c.name,
    })),
    toDelete: diffResult.toDelete,
    toUpdate: diffResult.toUpdate,
  };
}

/**
 * 現在の伏線マークダウンに対し、新しい伏線リストを追加または更新し、指定された古い伏線を削除したマークダウンを生成する。
 */
export function applyForeshadowingsToMarkdown(
  currentMarkdown: string,
  newItems: {
    category?: string | null;
    title: string;
    description?: string | null;
    status?: ForeshadowingStatus | null;
    placedSectionId?: string | null;
    resolvedSectionId?: string | null;
  }[],
  deleteTitles?: string[]
): string {
  const existing = parseForeshadowingsMarkdown(currentMarkdown);
  const merged = mergeEntitiesByKey(existing, newItems, {
    deleteKeys: buildDeleteSet(deleteTitles),
    keyOfNew: (item) => {
      const rawTitle =
        item.title ??
        (item as { name?: string }).name ??
        (item.description ? item.description.slice(0, 30) : "") ??
        "無題の伏線";
      return typeof rawTitle === "string" && rawTitle.trim()
        ? rawTitle.trim()
        : "無題の伏線";
    },
    keyOfParsed: (f) => (typeof f.title === "string" ? f.title.trim() : ""),
    merge: (prev, item, trimmedTitle) => ({
      category: normalizeCategory(item.category, prev?.category ?? "未分類"),
      description: item.description ?? prev?.description ?? "",
      placedSectionId:
        item.placedSectionId !== undefined
          ? item.placedSectionId
          : (prev?.placedSectionId ?? null),
      resolvedSectionId:
        item.resolvedSectionId !== undefined
          ? item.resolvedSectionId
          : (prev?.resolvedSectionId ?? null),
      status: item.status || prev?.status || "unresolved",
      title: trimmedTitle,
    }),
  });
  return serializeForeshadowingsToMarkdown(merged);
}

/**
 * 現在の伏線マークダウンから、指定された伏線タイトルを削除したマークダウンを生成する。
 */
export function deleteForeshadowingsFromMarkdown(
  currentMarkdown: string,
  deleteTitles: string[]
): string {
  return applyForeshadowingsToMarkdown(currentMarkdown, [], deleteTitles);
}

/**
 * 伏線マークダウンをパースし、正規化・ソートして改行や空行を適切に整形（フォーマット）したマークダウンを返す。
 */
export function formatForeshadowingsMarkdown(markdown: string): string {
  return formatEntityMarkdown(
    markdown,
    parseForeshadowingsMarkdown,
    serializeForeshadowingsToMarkdown
  );
}
