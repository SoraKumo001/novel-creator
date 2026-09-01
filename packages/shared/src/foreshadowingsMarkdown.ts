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
  buildMarkdownCategoryTree,
  calculateEntityDiff,
  findSectionByLine,
  scanMarkdownSections,
  writeMarkdownEntitySections,
  type MarkdownCategoryNode,
} from './markdownCore.js';
import type { ForeshadowingStatus } from './schemas/entities.js';

/** マークダウン解析後の伏線セクション。 */
export interface ParsedForeshadowingSection {
  category: string;
  title: string;
  description: string;
  status: ForeshadowingStatus;
  placedSectionId?: string | null;
  resolvedSectionId?: string | null;
}

/** フォーカストラッキング用のセクション情報（行範囲付き）。 */
export interface ForeshadowingSectionRange {
  category: string;
  title: string;
  name: string;
  /** `##` 見出し行の 0 始まり行番号。 */
  headingLine: number;
  /** 本文開始行（見出しの次行）の 0 始まり行番号。 */
  startLine: number;
  /** 本文終端行（次の見出しの前行、または文書末尾）の 0 始まり行番号（含む）。 */
  endLine: number;
  /** セクション本文。 */
  description: string;
  status: ForeshadowingStatus;
  placedSectionId?: string | null;
  resolvedSectionId?: string | null;
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
  }[],
): string {
  if (items.length === 0) return '';

  const normalized = items.map((f) => ({
    category: (f.category ?? '').trim() || '未分類',
    title: f.title.trim(),
    description: (f.description ?? '').trim(),
    status: f.status ?? 'unresolved',
    placedSectionId: f.placedSectionId ?? null,
    resolvedSectionId: f.resolvedSectionId ?? null,
  }));

  const sorted = [...normalized].sort((a, b) => {
    const c = a.category.localeCompare(b.category, 'ja');
    return c !== 0 ? c : a.title.localeCompare(b.title, 'ja');
  });

  return writeMarkdownEntitySections(sorted, {
    categoryOf: (item) => item.category,
    nameOf: (item) => item.title,
    writeBody: (item, lines) => {
      // ステータス等のメタ情報を HTML コメントとして付与
      const metaParts: string[] = [`status: ${item.status}`];
      if (item.placedSectionId) metaParts.push(`placed: ${item.placedSectionId}`);
      if (item.resolvedSectionId) metaParts.push(`resolved: ${item.resolvedSectionId}`);
      lines.push(`<!-- ${metaParts.join(', ')} -->`);
      lines.push('');

      if (item.description) {
        lines.push(item.description);
      }
      lines.push('');
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
  const match = /<!--\s*(.*?)\s*-->/.exec(line);
  if (!match) return {};

  const content = match[1];
  const parts = content.split(',').map((p) => p.trim());
  const result: {
    status?: ForeshadowingStatus;
    placedSectionId?: string;
    resolvedSectionId?: string;
  } = {};

  for (const part of parts) {
    const [key, val] = part.split(':').map((s) => s.trim());
    if (key === 'status') {
      if (val === 'resolved' || val === 'abandoned' || val === 'unresolved') {
        result.status = val;
      }
    } else if (key === 'placed' && val) {
      result.placedSectionId = val;
    } else if (key === 'resolved' && val) {
      result.resolvedSectionId = val;
    }
  }

  return result;
}

/**
 * マークダウン文書を解析して伏線セクション配列を返す。
 */
export function parseForeshadowingsMarkdown(markdown: string): ParsedForeshadowingSection[] {
  const rawSections = scanMarkdownSections(markdown);
  const sections: ParsedForeshadowingSection[] = [];
  const seen = new Set<string>();

  for (const raw of rawSections) {
    const key = `${raw.category}\u0000${raw.name}`;
    if (!seen.has(key)) {
      seen.add(key);

      let status: ForeshadowingStatus = 'unresolved';
      let placedSectionId: string | null = null;
      let resolvedSectionId: string | null = null;
      const cleanBodyLines: string[] = [];

      for (const line of raw.bodyLines) {
        if (/^\s*<!--.*?-->\s*$/.test(line)) {
          const meta = parseMetaComment(line);
          if (meta.status) status = meta.status;
          if (meta.placedSectionId !== undefined) placedSectionId = meta.placedSectionId;
          if (meta.resolvedSectionId !== undefined) resolvedSectionId = meta.resolvedSectionId;
        } else {
          cleanBodyLines.push(line);
        }
      }

      while (cleanBodyLines.length > 0 && cleanBodyLines[0].trim() === '') cleanBodyLines.shift();
      while (cleanBodyLines.length > 0 && cleanBodyLines[cleanBodyLines.length - 1].trim() === '')
        cleanBodyLines.pop();

      sections.push({
        category: raw.category,
        title: raw.name,
        description: cleanBodyLines.join('\n'),
        status,
        placedSectionId,
        resolvedSectionId,
      });
    }
  }

  return sections;
}

/**
 * マークダウン文書を走査し、行範囲情報を含むセクション配列を返す。
 */
export function scanForeshadowingSectionRanges(markdown: string): ForeshadowingSectionRange[] {
  const rawSections = scanMarkdownSections(markdown);
  return rawSections.map((raw) => {
    let status: ForeshadowingStatus = 'unresolved';
    let placedSectionId: string | null = null;
    let resolvedSectionId: string | null = null;
    const cleanBodyLines: string[] = [];

    for (const line of raw.bodyLines) {
      if (/^\s*<!--.*?-->\s*$/.test(line)) {
        const meta = parseMetaComment(line);
        if (meta.status) status = meta.status;
        if (meta.placedSectionId !== undefined) placedSectionId = meta.placedSectionId;
        if (meta.resolvedSectionId !== undefined) resolvedSectionId = meta.resolvedSectionId;
      } else {
        cleanBodyLines.push(line);
      }
    }

    while (cleanBodyLines.length > 0 && cleanBodyLines[0].trim() === '') cleanBodyLines.shift();
    while (cleanBodyLines.length > 0 && cleanBodyLines[cleanBodyLines.length - 1].trim() === '')
      cleanBodyLines.pop();

    return {
      category: raw.category,
      title: raw.name,
      name: raw.name,
      headingLine: raw.headingLine,
      startLine: raw.startLine,
      endLine: raw.endLine,
      description: cleanBodyLines.join('\n'),
      status,
      placedSectionId,
      resolvedSectionId,
    };
  });
}

/**
 * カーソル位置（0 始まり行番号）から所属する伏線セクションを特定する。
 */
export function findForeshadowingSectionByLine(
  markdown: string,
  lineNumber: number,
): ForeshadowingSectionRange | null {
  const ranges = scanForeshadowingSectionRanges(markdown);
  return findSectionByLine(ranges, lineNumber);
}

/**
 * マークダウンからカテゴリ構造ツリーを構築する。
 */
export function buildForeshadowingCategoryTree(markdown: string): ForeshadowingCategoryNode[] {
  return buildMarkdownCategoryTree(markdown);
}

/**
 * 既存の伏線レコードとパース済みセクションを比較し、
 * 作成・更新・削除の差分を算出する。
 */
export interface ForeshadowingsDiff {
  /** 新規作成すべき伏線。 */
  toCreate: ParsedForeshadowingSection[];
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
  /** 削除すべき伏線の id。 */
  toDelete: string[];
  /** 同一 (category, title) で重複出現した件数。 */
  duplicateCount: number;
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
  parsedSections: ParsedForeshadowingSection[],
): ForeshadowingsDiff {
  const normalizedExisting = existingItems.map((f) => ({
    id: f.id,
    name: f.title,
    category: (f.category ?? '').trim() || '未分類',
    description: f.description ?? '',
    status: f.status ?? 'unresolved',
    placedSectionId: f.placedSectionId ?? null,
    resolvedSectionId: f.resolvedSectionId ?? null,
  }));

  const normalizedParsed = parsedSections.map((s) => ({
    name: s.title,
    category: s.category.trim() || '未分類',
    description: s.description,
    status: s.status,
    placedSectionId: s.placedSectionId ?? null,
    resolvedSectionId: s.resolvedSectionId ?? null,
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
      id: ex.id,
      category: p.category,
      title: p.name,
      description: p.description,
      status: p.status,
      placedSectionId: p.placedSectionId,
      resolvedSectionId: p.resolvedSectionId,
    }),
  );

  return {
    toCreate: diffResult.toCreate.map((c) => ({
      category: c.category,
      title: c.name,
      description: c.description,
      status: c.status,
      placedSectionId: c.placedSectionId,
      resolvedSectionId: c.resolvedSectionId,
    })),
    toUpdate: diffResult.toUpdate,
    toDelete: diffResult.toDelete,
    duplicateCount: diffResult.duplicateCount,
  };
}
