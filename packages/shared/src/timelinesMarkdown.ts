/**
 * 年表（timelines）をマークダウン文書として直列化・解析するユーティリティ。
 *
 * マークダウン構造の規約:
 * - `# 時期・カテゴリ` = 年表の時期・時代・カテゴリ（level 1 見出し）
 * - `## 出来事・タイトル` = 出来事（level 2 見出し）
 * - `<!-- timestamp: ..., order: 1, sectionId: ... -->` = メタデータコメント
 * - 本文 = 出来事の補足・詳細
 */

import {
  buildMarkdownCategoryTree,
  calculateEntityDiff,
  findSectionByLine,
  formatMarkdownDocument,
  type MarkdownCategoryNode,
  scanMarkdownSections,
  writeMarkdownEntitySections,
} from "./markdownCore.js";

/** マークダウン解析後の年表セクション。 */
export interface ParsedTimelineSection {
  category: string;
  description: string;
  event: string;
  order: number;
  sectionId?: string | null;
  timestamp?: string | null;
}

/** フォーカストラッキング用のセクション情報（行範囲付き）。 */
export interface TimelineSectionRange {
  category: string;
  description: string;
  endLine: number;
  event: string;
  headingLine: number;
  name: string;
  order: number;
  sectionId?: string | null;
  startLine: number;
  timestamp?: string | null;
}

/** カテゴリごとのツリーノード。 */
export type TimelineCategoryNode = MarkdownCategoryNode;

/**
 * 年表リストを単一のマークダウン文書に直列化する。
 */
export function serializeTimelinesToMarkdown(
  items: {
    event: string;
    order?: number | null;
    sectionId?: string | null;
    timestamp?: string | null;
  }[]
): string {
  if (items.length === 0) {
    return "";
  }

  // order 順（未指定時は 0）で安定ソート
  const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return writeMarkdownEntitySections(sorted, {
    categoryOf: (item) => (item.timestamp ?? "").trim() || "年表",
    nameOf: (item) => item.event.trim(),
    writeBody: (item, lines) => {
      const metaParts: string[] = [];
      if (item.order !== undefined && item.order !== null) {
        metaParts.push(`order: ${item.order}`);
      }
      if (item.timestamp) {
        metaParts.push(`timestamp: ${item.timestamp}`);
      }
      if (item.sectionId) {
        metaParts.push(`sectionId: ${item.sectionId}`);
      }

      if (metaParts.length > 0) {
        lines.push(`<!-- ${metaParts.join(", ")} -->`);
        lines.push("");
      }
    },
  });
}

/**
 * メタデータコメント行（<!-- timestamp: ..., order: 1 ... -->）をパースする。
 */
function parseMetaComment(line: string): {
  order?: number;
  sectionId?: string;
  timestamp?: string;
} {
  const match = /<!--\s*(.*?)\s*-->/.exec(line);
  if (!match) {
    return {};
  }

  const content = match[1];
  const parts = content.split(",").map((p) => p.trim());
  const result: {
    order?: number;
    sectionId?: string;
    timestamp?: string;
  } = {};

  for (const part of parts) {
    const [key, val] = part.split(":").map((s) => s.trim());
    if (key === "order" && val) {
      const num = Number.parseInt(val, 10);
      if (!Number.isNaN(num)) {
        result.order = num;
      }
    } else if (key === "timestamp" && val) {
      result.timestamp = val;
    } else if (key === "sectionId" && val) {
      result.sectionId = val;
    }
  }

  return result;
}

/**
 * マークダウン文書を解析して年表セクション配列を返す。
 */
export function parseTimelinesMarkdown(
  markdown: string
): ParsedTimelineSection[] {
  const rawSections = scanMarkdownSections(markdown);
  const sections: ParsedTimelineSection[] = [];
  const seen = new Set<string>();

  let autoOrder = 0;
  for (const raw of rawSections) {
    autoOrder++;
    const key = `${raw.category}\u0000${raw.name}`;
    if (!seen.has(key)) {
      seen.add(key);

      let order = autoOrder;
      let timestamp: string | null =
        raw.category !== "年表" && raw.category !== "未分類"
          ? raw.category
          : null;
      let sectionId: string | null = null;
      const cleanBodyLines: string[] = [];

      for (const line of raw.bodyLines) {
        if (/^\s*<!--.*?-->\s*$/.test(line)) {
          const meta = parseMetaComment(line);
          if (meta.order !== undefined) {
            order = meta.order;
          }
          if (meta.timestamp !== undefined) {
            timestamp = meta.timestamp;
          }
          if (meta.sectionId !== undefined) {
            sectionId = meta.sectionId;
          }
        } else {
          cleanBodyLines.push(line);
        }
      }

      while (cleanBodyLines.length > 0 && cleanBodyLines[0].trim() === "") {
        cleanBodyLines.shift();
      }
      while (
        cleanBodyLines.length > 0 &&
        cleanBodyLines.at(-1)?.trim() === ""
      ) {
        cleanBodyLines.pop();
      }

      sections.push({
        category: raw.category,
        description: cleanBodyLines.join("\n"),
        event: raw.name,
        order,
        sectionId,
        timestamp,
      });
    }
  }

  return sections;
}

/**
 * マークダウン文書を走査し、行範囲情報を含むセクション配列を返す。
 */
export function scanTimelineSectionRanges(
  markdown: string
): TimelineSectionRange[] {
  const rawSections = scanMarkdownSections(markdown);
  let autoOrder = 0;
  return rawSections.map((raw) => {
    autoOrder++;
    let order = autoOrder;
    let timestamp: string | null =
      raw.category !== "年表" && raw.category !== "未分類"
        ? raw.category
        : null;
    let sectionId: string | null = null;
    const cleanBodyLines: string[] = [];

    for (const line of raw.bodyLines) {
      if (/^\s*<!--.*?-->\s*$/.test(line)) {
        const meta = parseMetaComment(line);
        if (meta.order !== undefined) {
          order = meta.order;
        }
        if (meta.timestamp !== undefined) {
          timestamp = meta.timestamp;
        }
        if (meta.sectionId !== undefined) {
          sectionId = meta.sectionId;
        }
      } else {
        cleanBodyLines.push(line);
      }
    }

    while (cleanBodyLines.length > 0 && cleanBodyLines[0].trim() === "") {
      cleanBodyLines.shift();
    }
    while (cleanBodyLines.length > 0 && cleanBodyLines.at(-1)?.trim() === "") {
      cleanBodyLines.pop();
    }

    return {
      category: raw.category,
      description: cleanBodyLines.join("\n"),
      endLine: raw.endLine,
      event: raw.name,
      headingLine: raw.headingLine,
      name: raw.name,
      order,
      sectionId,
      startLine: raw.startLine,
      timestamp,
    };
  });
}

/**
 * カーソル位置（0 始まり行番号）から所属する年表セクションを特定する。
 */
export function findTimelineSectionByLine(
  markdown: string,
  lineNumber: number
): TimelineSectionRange | null {
  const ranges = scanTimelineSectionRanges(markdown);
  return findSectionByLine(ranges, lineNumber);
}

/**
 * マークダウンからカテゴリ構造ツリーを構築する。
 */
export function buildTimelineCategoryTree(
  markdown: string
): TimelineCategoryNode[] {
  return buildMarkdownCategoryTree(markdown);
}

/**
 * 既存の年表レコードとパース済みセクションを比較し、
 * 作成・更新・削除の差分を算出する。
 */
export interface TimelinesDiff {
  duplicateCount: number;
  toCreate: ParsedTimelineSection[];
  toDelete: string[];
  toUpdate: {
    event: string;
    id: string;
    order: number;
    sectionId: string | null;
    timestamp: string | null;
  }[];
}

export function diffTimelines(
  existingItems: {
    event: string;
    id: string;
    order: number;
    sectionId?: string | null;
    timestamp?: string | null;
  }[],
  parsedSections: ParsedTimelineSection[]
): TimelinesDiff {
  const normalizedExisting = existingItems.map((t) => ({
    category: (t.timestamp ?? "").trim() || "年表",
    description: "",
    id: t.id,
    name: t.event,
    order: t.order,
    sectionId: t.sectionId ?? null,
    timestamp: t.timestamp ?? null,
  }));

  const normalizedParsed = parsedSections.map((s) => ({
    category: s.category.trim() || "年表",
    description: s.description,
    name: s.event,
    order: s.order,
    sectionId: s.sectionId ?? null,
    timestamp: s.timestamp ?? null,
  }));

  const diffResult = calculateEntityDiff(
    normalizedExisting,
    normalizedParsed,
    (a, b) =>
      a.timestamp !== b.timestamp ||
      a.order !== b.order ||
      a.sectionId !== b.sectionId,
    (ex, p) => ({
      event: p.name,
      id: ex.id,
      order: p.order,
      sectionId: p.sectionId,
      timestamp: p.timestamp,
    })
  );

  return {
    duplicateCount: diffResult.duplicateCount,
    toCreate: diffResult.toCreate.map((c) => ({
      category: c.category,
      description: c.description,
      event: c.name,
      order: c.order,
      sectionId: c.sectionId,
      timestamp: c.timestamp,
    })),
    toDelete: diffResult.toDelete,
    toUpdate: diffResult.toUpdate,
  };
}

/**
 * 現在の年表マークダウンに対し、新しい年表リストを追加または更新し、指定された古い出来事を削除したマークダウンを生成する。
 */
export function applyTimelinesToMarkdown(
  currentMarkdown: string,
  newItems: {
    event: string;
    order?: number | null;
    sectionId?: string | null;
    timestamp?: string | null;
  }[],
  deleteEvents?: string[]
): string {
  const existing = parseTimelinesMarkdown(currentMarkdown);
  const deleteSet = new Set(
    (deleteEvents ?? []).map((t) => t.trim()).filter((t) => t.length > 0)
  );
  const map = new Map<string, ParsedTimelineSection>();
  for (const t of existing) {
    if (!deleteSet.has(t.event.trim())) {
      map.set(t.event.trim(), t);
    }
  }
  let maxOrder = 0;
  for (const t of map.values()) {
    if (t.order > maxOrder) {
      maxOrder = t.order;
    }
  }

  for (const item of newItems) {
    const trimmedEvent = item.event.trim();
    const prev = map.get(trimmedEvent);
    maxOrder++;
    map.set(trimmedEvent, {
      category: (item.timestamp ?? "").trim() || prev?.category || "年表",
      event: trimmedEvent,
      description: prev?.description ?? "",
      order:
        item.order !== undefined && item.order !== null
          ? item.order
          : (prev?.order ?? maxOrder),
      timestamp:
        item.timestamp !== undefined
          ? item.timestamp
          : (prev?.timestamp ?? null),
      sectionId:
        item.sectionId !== undefined
          ? item.sectionId
          : (prev?.sectionId ?? null),
    });
  }
  return serializeTimelinesToMarkdown(Array.from(map.values()));
}

/**
 * 現在の年表マークダウンから、指定された出来事を削除したマークダウンを生成する。
 */
export function deleteTimelinesFromMarkdown(
  currentMarkdown: string,
  deleteEvents: string[]
): string {
  return applyTimelinesToMarkdown(currentMarkdown, [], deleteEvents);
}

/**
 * 年表マークダウンをパースし、正規化・ソートして整形したマークダウンを返す。
 */
export function formatTimelinesMarkdown(markdown: string): string {
  const parsed = parseTimelinesMarkdown(markdown);
  if (parsed.length === 0) {
    return formatMarkdownDocument(markdown);
  }
  return formatMarkdownDocument(serializeTimelinesToMarkdown(parsed));
}
