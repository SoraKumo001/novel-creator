/**
 * プロット（章・節構成およびあらすじ・概要）をマークダウン文書として直列化・解析するユーティリティ。
 *
 * マークダウン構造の規約:
 * - `# 章タイトル` = 章（level 1 見出し）
 * - 章見出し直後の本文 = 章の概要・プロットメモ（chapter.summary）
 * - `## 節タイトル` = 節（level 2 見出し）
 * - `<!-- sectionOrder: 1 -->` = 節のメタデータコメント（任意）
 * - 節見出し（およびメタデータ）直後の本文 = 節の概要・プロットメモ（section.summary）
 */

import {
  buildMarkdownCategoryTree,
  formatMarkdownDocument,
  type MarkdownCategoryNode,
  scanMarkdownSections,
} from "./markdownCore.js";

/** マークダウン解析後の節情報 */
export interface ParsedPlotSectionItem {
  order: number;
  summary: string;
  title: string;
}

/** マークダウン解析後の章情報（節リスト付き） */
export interface ParsedPlotChapterItem {
  order: number;
  sections: ParsedPlotSectionItem[];
  summary: string;
  title: string;
}

/** フォーカストラッキング用のセクション情報（行範囲付き）。 */
export interface PlotSectionRange {
  category: string;
  endLine: number;
  headingLine: number;
  isChapter: boolean;
  name: string;
  order: number;
  startLine: number;
  summary: string;
  title: string;
}

/** カテゴリごとのツリーノード。 */
export type PlotCategoryNode = MarkdownCategoryNode;

/**
 * 章・節リストを単一のマークダウン文書に直列化する。
 */
export function serializePlotToMarkdown(
  chapters: {
    order?: number | null;
    sections?: {
      order?: number | null;
      summary?: string | null;
      title?: string | null;
    }[];
    summary?: string | null;
    title: string;
  }[]
): string {
  if (chapters.length === 0) {
    return "";
  }

  const sortedChapters = [...chapters].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  const lines: string[] = [];

  for (const ch of sortedChapters) {
    const chTitle = ch.title.trim() || "無題の章";
    lines.push(`# ${chTitle}`);
    lines.push("");

    const chSummary = (ch.summary ?? "").trim();
    if (chSummary) {
      lines.push(chSummary);
      lines.push("");
    }

    const sections = ch.sections ?? [];
    const sortedSections = [...sections].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );

    for (const sec of sortedSections) {
      const secTitle = sec.title?.trim() || `節 ${sec.order ?? 1}`;
      lines.push(`## ${secTitle}`);
      lines.push("");

      const secSummary = (sec.summary ?? "").trim();
      if (secSummary) {
        lines.push(secSummary);
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

/**
 * マークダウン文書を解析して章・節配列を返す。
 */
export function parsePlotMarkdown(markdown: string): ParsedPlotChapterItem[] {
  const lines = markdown.split("\n");
  const chapters: ParsedPlotChapterItem[] = [];
  let currentChapter: ParsedPlotChapterItem | null = null;
  let currentSection: ParsedPlotSectionItem | null = null;
  let inFence = false;
  let chOrder = 0;
  let secOrder = 0;

  let bodyBuffer: string[] = [];

  function flushBuffer() {
    const text = bodyBuffer.join("\n").trim();
    bodyBuffer = [];
    if (currentSection) {
      currentSection.summary = text;
    } else if (currentChapter) {
      currentChapter.summary = text;
    }
  }

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      bodyBuffer.push(line);
      continue;
    }
    if (inFence) {
      bodyBuffer.push(line);
      continue;
    }

    const h1 = /^#\s+(.+?)\s*$/.exec(line);
    if (h1) {
      flushBuffer();
      chOrder++;
      secOrder = 0;
      currentSection = null;
      currentChapter = {
        title: h1[1].trim(),
        summary: "",
        order: chOrder,
        sections: [],
      };
      chapters.push(currentChapter);
      continue;
    }

    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      flushBuffer();
      if (!currentChapter) {
        chOrder++;
        currentChapter = {
          title: "プロット",
          summary: "",
          order: chOrder,
          sections: [],
        };
        chapters.push(currentChapter);
      }
      secOrder++;
      currentSection = {
        title: h2[1].trim(),
        summary: "",
        order: secOrder,
      };
      currentChapter.sections.push(currentSection);
      continue;
    }

    bodyBuffer.push(line);
  }

  flushBuffer();
  return chapters;
}

/**
 * マークダウン文書を走査し、行範囲情報を含むセクション配列を返す。
 */
export function scanPlotSectionRanges(markdown: string): PlotSectionRange[] {
  const rawSections = scanMarkdownSections(markdown);
  return rawSections.map((raw) => ({
    category: raw.category,
    endLine: raw.endLine,
    headingLine: raw.headingLine,
    isChapter: false,
    name: raw.name,
    order: 0,
    startLine: raw.startLine,
    summary: raw.bodyLines.join("\n").trim(),
    title: raw.name,
  }));
}

/**
 * カーソル位置（0 始まり行番号）から所属するプロットセクションを特定する。
 */
export function findPlotSectionByLine(
  markdown: string,
  lineNumber: number
): PlotSectionRange | null {
  const ranges = scanPlotSectionRanges(markdown);
  for (const r of ranges) {
    if (lineNumber >= r.headingLine && lineNumber <= r.endLine) {
      return r;
    }
  }
  return null;
}

/**
 * マークダウンからカテゴリ構造ツリーを構築する。
 */
export function buildPlotCategoryTree(markdown: string): PlotCategoryNode[] {
  return buildMarkdownCategoryTree(markdown);
}

/**
 * プロット差分計算インターフェース
 */
export interface PlotDiff {
  chaptersToCreate: ParsedPlotChapterItem[];
  chaptersToDelete: string[];
  chaptersToUpdate: {
    id: string;
    order: number;
    summary: string;
    title: string;
  }[];
  sectionsToCreate: {
    chapterId: string;
    order: number;
    summary: string;
    title: string;
  }[];
  sectionsToDelete: string[];
  sectionsToUpdate: {
    id: string;
    order: number;
    summary: string;
    title: string;
  }[];
}

/**
 * 既存の章・節とパース結果から差分を計算する。
 */
export function diffPlot(
  existingChapters: {
    id: string;
    order: number;
    sections?: {
      id: string;
      order: number;
      summary?: string | null;
      title?: string | null;
    }[];
    summary?: string | null;
    title: string;
  }[],
  parsedChapters: ParsedPlotChapterItem[]
): PlotDiff {
  const chaptersToCreate: ParsedPlotChapterItem[] = [];
  const chaptersToUpdate: PlotDiff["chaptersToUpdate"] = [];
  const chaptersToDelete: string[] = [];
  const sectionsToCreate: PlotDiff["sectionsToCreate"] = [];
  const sectionsToUpdate: PlotDiff["sectionsToUpdate"] = [];
  const sectionsToDelete: string[] = [];

  const existingChapterMap = new Map<
    string,
    (typeof existingChapters)[number]
  >();
  for (const ch of existingChapters) {
    existingChapterMap.set(ch.title.trim(), ch);
  }

  const seenChapterTitles = new Set<string>();

  for (const parsedCh of parsedChapters) {
    const trimmedTitle = parsedCh.title.trim();
    seenChapterTitles.add(trimmedTitle);
    const existingCh = existingChapterMap.get(trimmedTitle);

    if (!existingCh) {
      chaptersToCreate.push(parsedCh);
    } else {
      if (
        (existingCh.summary ?? "").trim() !== parsedCh.summary.trim() ||
        existingCh.order !== parsedCh.order
      ) {
        chaptersToUpdate.push({
          id: existingCh.id,
          title: parsedCh.title,
          summary: parsedCh.summary,
          order: parsedCh.order,
        });
      }

      const existingSectionMap = new Map<
        string,
        NonNullable<typeof existingCh.sections>[number]
      >();
      for (const sec of existingCh.sections ?? []) {
        existingSectionMap.set((sec.title ?? "").trim(), sec);
      }

      const seenSectionTitles = new Set<string>();

      for (const parsedSec of parsedCh.sections) {
        const secTitle = parsedSec.title.trim();
        seenSectionTitles.add(secTitle);
        const existingSec = existingSectionMap.get(secTitle);

        if (!existingSec) {
          sectionsToCreate.push({
            chapterId: existingCh.id,
            title: parsedSec.title,
            summary: parsedSec.summary,
            order: parsedSec.order,
          });
        } else if (
          (existingSec.summary ?? "").trim() !== parsedSec.summary.trim() ||
          existingSec.order !== parsedSec.order
        ) {
          sectionsToUpdate.push({
            id: existingSec.id,
            title: parsedSec.title,
            summary: parsedSec.summary,
            order: parsedSec.order,
          });
        }
      }

      for (const [secTitle, sec] of existingSectionMap) {
        if (!seenSectionTitles.has(secTitle)) {
          sectionsToDelete.push(sec.id);
        }
      }
    }
  }

  for (const [chTitle, ch] of existingChapterMap) {
    if (!seenChapterTitles.has(chTitle)) {
      chaptersToDelete.push(ch.id);
      for (const sec of ch.sections ?? []) {
        sectionsToDelete.push(sec.id);
      }
    }
  }

  return {
    chaptersToCreate,
    chaptersToUpdate,
    chaptersToDelete,
    sectionsToCreate,
    sectionsToUpdate,
    sectionsToDelete,
  };
}

/**
 * 現在のプロットマークダウンに対し、新しい章・節を追加または更新し、指定された章を削除したマークダウンを生成する。
 */
export function applyPlotToMarkdown(
  currentMarkdown: string,
  newChapters: {
    order?: number | null;
    sections?: {
      order?: number | null;
      summary?: string | null;
      title?: string | null;
    }[];
    summary?: string | null;
    title: string;
  }[],
  deleteTitles?: string[]
): string {
  const existing = parsePlotMarkdown(currentMarkdown);
  const deleteSet = new Set(
    (deleteTitles ?? []).map((t) => t.trim()).filter((t) => t.length > 0)
  );

  const chapterMap = new Map<string, ParsedPlotChapterItem>();
  for (const ch of existing) {
    if (!deleteSet.has(ch.title.trim())) {
      chapterMap.set(ch.title.trim(), ch);
    }
  }

  let maxOrder = 0;
  for (const ch of chapterMap.values()) {
    if (ch.order > maxOrder) {
      maxOrder = ch.order;
    }
  }

  for (const newCh of newChapters) {
    const trimmedTitle = newCh.title.trim();
    const prev = chapterMap.get(trimmedTitle);
    maxOrder++;

    const sections = newCh.sections
      ? newCh.sections.map((s, idx) => ({
          title: s.title?.trim() || `節 ${idx + 1}`,
          summary: s.summary?.trim() || "",
          order: s.order ?? idx + 1,
        }))
      : (prev?.sections ?? []);

    chapterMap.set(trimmedTitle, {
      title: trimmedTitle,
      summary:
        newCh.summary !== undefined
          ? (newCh.summary ?? "").trim()
          : (prev?.summary ?? ""),
      order:
        newCh.order !== undefined && newCh.order !== null
          ? newCh.order
          : (prev?.order ?? maxOrder),
      sections,
    });
  }

  return serializePlotToMarkdown(Array.from(chapterMap.values()));
}

/**
 * 現在のプロットマークダウンから、指定された章を削除したマークダウンを生成する。
 */
export function deletePlotFromMarkdown(
  currentMarkdown: string,
  deleteTitles: string[]
): string {
  return applyPlotToMarkdown(currentMarkdown, [], deleteTitles);
}

/**
 * プロットマークダウンをパースし、正規化・ソートして整形したマークダウンを返す。
 */
export function formatPlotMarkdown(markdown: string): string {
  const parsed = parsePlotMarkdown(markdown);
  if (parsed.length === 0) {
    return formatMarkdownDocument(markdown);
  }
  return formatMarkdownDocument(serializePlotToMarkdown(parsed));
}
