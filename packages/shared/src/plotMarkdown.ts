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
  formatEntityMarkdown,
  isMetaCommentLine,
  type MarkdownCategoryNode,
  parseMetaPairs,
  scanEntityRanges,
} from "./markdownCore.js";

/** マークダウン解析後の節情報 */
export interface ParsedPlotSectionItem {
  id?: string;
  order: number;
  summary: string;
  title: string;
}

/** マークダウン解析後の章情報（節リスト付き） */
export interface ParsedPlotChapterItem {
  id?: string;
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
    id?: string | null;
    order?: number | null;
    sections?: {
      id?: string | null;
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
    const chapterId = (ch.id ?? "").trim();
    if (chapterId) {
      lines.push(`<!-- chapterId: ${chapterId} -->`);
    }
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
      const sectionId = (sec.id ?? "").trim();
      if (sectionId) {
        lines.push(`<!-- sectionId: ${sectionId} -->`);
      }
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
  // 見出し直後のメタコメント (<!-- chapterId/sectionId -->) を検出するための待機状態。
  // 空行を挟んでも有効とし、本文開始で解除する。
  let pendingChapterMeta: ParsedPlotChapterItem | null = null;
  let pendingSectionMeta: ParsedPlotSectionItem | null = null;

  function flushBuffer() {
    const text = bodyBuffer.join("\n").trim();
    bodyBuffer = [];
    if (currentSection) {
      currentSection.summary = text;
    } else if (currentChapter) {
      currentChapter.summary = text;
    }
  }

  function consumePendingMeta(line: string): boolean {
    if (!pendingChapterMeta && !pendingSectionMeta) {
      return false;
    }
    if (line.trim() === "") {
      return true;
    }
    if (isMetaCommentLine(line)) {
      const pairs = parseMetaPairs(line);
      if (pendingSectionMeta) {
        const sid = (pairs["sectionId"] ?? "").trim();
        if (sid) {
          pendingSectionMeta.id = sid;
        }
        // 節メタ待機中は章メタも消費済み扱いにする
        pendingSectionMeta = null;
        pendingChapterMeta = null;
      } else if (pendingChapterMeta) {
        const cid = (pairs["chapterId"] ?? "").trim();
        if (cid) {
          pendingChapterMeta.id = cid;
        }
        if (cid) {
          pendingChapterMeta = null;
        }
        // chapterId を含まない未知コメントは本文扱いにせず捨てるが、
        // 後続の正しいメタ行を拾えるよう待機は維持する
      }
      return true;
    }
    pendingChapterMeta = null;
    pendingSectionMeta = null;
    return false;
  }

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      pendingChapterMeta = null;
      pendingSectionMeta = null;
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
      pendingChapterMeta = currentChapter;
      pendingSectionMeta = null;
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
      pendingChapterMeta = null;
      secOrder++;
      currentSection = {
        title: h2[1].trim(),
        summary: "",
        order: secOrder,
      };
      currentChapter.sections.push(currentSection);
      pendingSectionMeta = currentSection;
      continue;
    }

    if (consumePendingMeta(line)) {
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
  return scanEntityRanges(markdown, (raw) => ({
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
    chapterId?: string;
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

  const existingChapterById = new Map<
    string,
    (typeof existingChapters)[number]
  >();
  const existingChapterByTitle = new Map<
    string,
    (typeof existingChapters)[number]
  >();
  for (const ch of existingChapters) {
    if (ch.id) {
      existingChapterById.set(ch.id, ch);
    }
    const key = ch.title.trim();
    if (!existingChapterByTitle.has(key)) {
      existingChapterByTitle.set(key, ch);
    }
  }

  // 節のグローバル照合用 (移動検出のため章をまたいで ID 検索できる)
  const existingSectionById = new Map<
    string,
    {
      chapterId: string;
      section: NonNullable<
        (typeof existingChapters)[number]["sections"]
      >[number];
    }
  >();
  for (const ch of existingChapters) {
    for (const sec of ch.sections ?? []) {
      if (sec.id) {
        existingSectionById.set(sec.id, { chapterId: ch.id, section: sec });
      }
    }
  }

  const seenChapterIds = new Set<string>();
  const seenSectionIds = new Set<string>();
  // レガシー fallback でタイトル消費済みの既存章・節 (二重マッチ防止)
  const consumedChapterIds = new Set<string>();
  const consumedSectionIds = new Set<string>();
  // parsed 章 → 解決済み existing 章 id (新規は null)
  const resolvedChapterIdByIndex = new Map<number, string | null>();

  parsedChapters.forEach((parsedCh, parsedIndex) => {
    const parsedId = (parsedCh.id ?? "").trim();
    let existingCh: (typeof existingChapters)[number] | undefined;
    if (parsedId && existingChapterById.has(parsedId)) {
      existingCh = existingChapterById.get(parsedId);
      seenChapterIds.add(existingCh?.id ?? parsedId);
    } else {
      const fallback = existingChapterByTitle.get(parsedCh.title.trim());
      if (fallback && !consumedChapterIds.has(fallback.id)) {
        existingCh = fallback;
      }
    }

    if (!existingCh) {
      chaptersToCreate.push(parsedCh);
      resolvedChapterIdByIndex.set(parsedIndex, null);
      return;
    }
    consumedChapterIds.add(existingCh.id);
    seenChapterIds.add(existingCh.id);
    resolvedChapterIdByIndex.set(parsedIndex, existingCh.id);

    if (
      existingCh.title.trim() !== parsedCh.title.trim() ||
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
  });

  // 節の差分 (章マッチ済みの場合のみ。新規章の節は chaptersToCreate に含まれる)
  parsedChapters.forEach((parsedCh, parsedIndex) => {
    const resolvedChapterId = resolvedChapterIdByIndex.get(parsedIndex);
    if (!resolvedChapterId) {
      return;
    }
    const existingCh = existingChapterById.get(resolvedChapterId);
    if (!existingCh) {
      return;
    }
    const existingSections = existingCh.sections ?? [];
    const fallbackMap = new Map<string, (typeof existingSections)[number]>();
    for (const sec of existingSections) {
      if (consumedSectionIds.has(sec.id)) {
        continue;
      }
      const key = (sec.title ?? "").trim();
      if (!fallbackMap.has(key)) {
        fallbackMap.set(key, sec);
      }
    }

    for (const parsedSec of parsedCh.sections) {
      const parsedSecId = (parsedSec.id ?? "").trim();
      const globalHit =
        parsedSecId && existingSectionById.has(parsedSecId)
          ? existingSectionById.get(parsedSecId)
          : undefined;
      if (globalHit && !seenSectionIds.has(globalHit.section.id)) {
        seenSectionIds.add(globalHit.section.id);
        consumedSectionIds.add(globalHit.section.id);
        const moved = globalHit.chapterId !== resolvedChapterId;
        if (
          moved ||
          (globalHit.section.title ?? "").trim() !== parsedSec.title.trim() ||
          (globalHit.section.summary ?? "").trim() !==
            parsedSec.summary.trim() ||
          globalHit.section.order !== parsedSec.order
        ) {
          sectionsToUpdate.push({
            id: globalHit.section.id,
            title: parsedSec.title,
            summary: parsedSec.summary,
            order: parsedSec.order,
            ...(moved ? { chapterId: resolvedChapterId } : {}),
          });
        }
        fallbackMap.delete((globalHit.section.title ?? "").trim());
        continue;
      }
      if (globalHit) {
        continue;
      }
      const fallback = fallbackMap.get(parsedSec.title.trim());
      if (fallback && !seenSectionIds.has(fallback.id)) {
        seenSectionIds.add(fallback.id);
        consumedSectionIds.add(fallback.id);
        fallbackMap.delete(parsedSec.title.trim());
        if (
          (fallback.summary ?? "").trim() !== parsedSec.summary.trim() ||
          fallback.order !== parsedSec.order
        ) {
          sectionsToUpdate.push({
            id: fallback.id,
            title: parsedSec.title,
            summary: parsedSec.summary,
            order: parsedSec.order,
          });
        }
        continue;
      }
      if (parsedSecId && existingSectionById.has(parsedSecId)) {
        // 既に他所で消費済みの重複 ID は無視する
        continue;
      }
      sectionsToCreate.push({
        chapterId: resolvedChapterId,
        title: parsedSec.title,
        summary: parsedSec.summary,
        order: parsedSec.order,
      });
    }
  });

  for (const ch of existingChapters) {
    if (!seenChapterIds.has(ch.id)) {
      chaptersToDelete.push(ch.id);
      for (const sec of ch.sections ?? []) {
        if (!seenSectionIds.has(sec.id)) {
          sectionsToDelete.push(sec.id);
          seenSectionIds.add(sec.id);
        }
      }
    }
  }
  for (const [, entry] of existingSectionById) {
    if (!seenSectionIds.has(entry.section.id)) {
      sectionsToDelete.push(entry.section.id);
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
 * 章タイトルの照合用正規化: LLM が付与しがちな "第N章 " 接頭辞を除去して比較する。
 * マッチング専用であり、保存されるタイトル自体は変更しない。
 */
export function normalizeChapterTitleForMatch(title: string): string {
  return title
    .trim()
    .replace(/^第[\d０-９一二三四五六七八九十百千\s　・.-]+章\s*/u, "")
    .trim();
}

/**
 * 節タイトルの照合用正規化 ("第N節 " 接頭辞を除去して比較する。マッチング専用)。
 */
export function normalizeSectionTitleForMatch(title: string): string {
  return title
    .trim()
    .replace(/^第[\d０-９一二三四五六七八九十百千\s　・.-]+節\s*/u, "")
    .trim();
}

/**
 * 現在のプロットマークダウンに対し、新しい章・節を追加または更新し、指定された章を削除したマークダウンを生成する。
 *
 * マージ優先順位:
 * 1. ID 一致 (newCh.id) が最優先。章タイトルは、接頭辞正規化後の比較で
 *    差異がある場合のみリネームとして新タイトルを採用し、"第N章 " の有無だけの
 *    差なら既存タイトルを保持する (LLM の接頭辞付与による重複作成を防ぐ)。
 * 2. oldTitle (更新元タイトル) による照合。exact → 接頭辞非依存の順。
 * 3. 新タイトルによる照合。exact → 接頭辞非依存の順。
 * 4. どれにも当たらなければ末尾に新規追加する。
 */
export function applyPlotToMarkdown(
  currentMarkdown: string,
  newChapters: {
    id?: string | null;
    oldTitle?: string | null;
    order?: number | null;
    sections?: {
      id?: string | null;
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
  const deleteExact = new Set(
    (deleteTitles ?? []).map((t) => t.trim()).filter((t) => t.length > 0)
  );
  const deleteNormalized = new Set(
    [...deleteExact].map((t) => normalizeChapterTitleForMatch(t))
  );

  const working: ParsedPlotChapterItem[] = existing.filter((ch) => {
    const trimmed = ch.title.trim();
    if (deleteExact.has(trimmed)) {
      return false;
    }
    return !deleteNormalized.has(normalizeChapterTitleForMatch(trimmed));
  });

  const chapterById = new Map<string, ParsedPlotChapterItem>();
  for (const ch of working) {
    if (ch.id) {
      chapterById.set(ch.id, ch);
    }
  }

  function findChapterByTitle(
    title: string
  ): ParsedPlotChapterItem | undefined {
    const trimmed = title.trim();
    const exact = working.find((ch) => ch.title.trim() === trimmed);
    if (exact) {
      return exact;
    }
    const normalized = normalizeChapterTitleForMatch(trimmed);
    return working.find(
      (ch) => normalizeChapterTitleForMatch(ch.title) === normalized
    );
  }

  let maxOrder = 0;
  for (const ch of working) {
    if (ch.order > maxOrder) {
      maxOrder = ch.order;
    }
  }

  function mergeSections(
    target: ParsedPlotChapterItem,
    incoming:
      | {
          id?: string | null;
          order?: number | null;
          summary?: string | null;
          title?: string | null;
        }[]
      | undefined
  ): void {
    if (!incoming) {
      return;
    }
    const secById = new Map<string, ParsedPlotSectionItem>();
    for (const sec of target.sections) {
      if (sec.id) {
        secById.set(sec.id, sec);
      }
    }
    function findSectionByTitle(
      title: string
    ): ParsedPlotSectionItem | undefined {
      const trimmed = title.trim();
      const exact = target.sections.find((s) => s.title.trim() === trimmed);
      if (exact) {
        return exact;
      }
      const normalized = normalizeSectionTitleForMatch(trimmed);
      return target.sections.find(
        (s) => normalizeSectionTitleForMatch(s.title) === normalized
      );
    }
    let maxSecOrder = 0;
    for (const sec of target.sections) {
      if (sec.order > maxSecOrder) {
        maxSecOrder = sec.order;
      }
    }
    for (const [idx, s] of incoming.entries()) {
      const sid = (s.id ?? "").trim();
      let secTarget: ParsedPlotSectionItem | undefined;
      if (sid && secById.has(sid)) {
        secTarget = secById.get(sid);
      } else if (s.title) {
        secTarget = findSectionByTitle(s.title);
      }
      if (secTarget) {
        const incomingTitle = (s.title ?? "").trim();
        if (
          incomingTitle &&
          normalizeSectionTitleForMatch(incomingTitle) !==
            normalizeSectionTitleForMatch(secTarget.title) &&
          (sid || incomingTitle !== secTarget.title.trim())
        ) {
          secTarget.title = incomingTitle;
        }
        if (s.summary !== undefined) {
          secTarget.summary = (s.summary ?? "").trim();
        }
        if (s.order !== undefined && s.order !== null) {
          secTarget.order = s.order;
        }
        if (sid && !secTarget.id) {
          secTarget.id = sid;
          secById.set(sid, secTarget);
        }
      } else {
        maxSecOrder++;
        const created: ParsedPlotSectionItem = {
          id: sid || undefined,
          title: (s.title ?? "").trim() || `節 ${idx + 1}`,
          summary: (s.summary ?? "").trim(),
          order: s.order ?? maxSecOrder,
        };
        target.sections.push(created);
        if (created.id) {
          secById.set(created.id, created);
        }
      }
    }
  }

  for (const newCh of newChapters) {
    const trimmedTitle = newCh.title.trim();
    const incomingId = (newCh.id ?? "").trim();
    const oldTitle = (newCh.oldTitle ?? "").trim();

    let target: ParsedPlotChapterItem | undefined;
    if (incomingId && chapterById.has(incomingId)) {
      target = chapterById.get(incomingId);
    }
    if (!target && oldTitle) {
      target = findChapterByTitle(oldTitle);
    }
    if (!target && trimmedTitle) {
      target = findChapterByTitle(trimmedTitle);
    }

    if (target) {
      // ID/oldTitle 経由のマッチで接頭辞正規化後の差異がある場合のみリネーム扱い。
      // タイトル照合でも同一章に当たる場合は正規化済みで一致しているため
      // 既存タイトルを保持する ("第N章 " の有無だけの差で重複作成しない)。
      // ただし新タイトルが別章に一致する場合は重複を避けるため改名しない。
      const titleHit = trimmedTitle
        ? findChapterByTitle(trimmedTitle)
        : undefined;
      if (!titleHit || titleHit === target) {
        if (
          trimmedTitle &&
          titleHit !== target &&
          normalizeChapterTitleForMatch(trimmedTitle) !==
            normalizeChapterTitleForMatch(target.title)
        ) {
          target.title = trimmedTitle;
        }
      }
      // titleHit が別章を指す場合は改名せず概要のみ更新する (タイトル重複を避ける)
      if (newCh.summary !== undefined) {
        target.summary = (newCh.summary ?? "").trim();
      }
      if (newCh.order !== undefined && newCh.order !== null) {
        target.order = newCh.order;
      }
      if (incomingId && !target.id) {
        target.id = incomingId;
        chapterById.set(incomingId, target);
      }
      mergeSections(target, newCh.sections);
    } else {
      maxOrder++;
      const sections: ParsedPlotSectionItem[] = (newCh.sections ?? []).map(
        (s, idx) => ({
          id: (s.id ?? "").trim() || undefined,
          title: s.title?.trim() || `節 ${idx + 1}`,
          summary: (s.summary ?? "").trim() || "",
          order: s.order ?? idx + 1,
        })
      );
      const created: ParsedPlotChapterItem = {
        id: incomingId || undefined,
        title: trimmedTitle,
        summary: (newCh.summary ?? "").trim(),
        order:
          newCh.order !== undefined && newCh.order !== null
            ? newCh.order
            : maxOrder,
        sections,
      };
      working.push(created);
      if (created.id) {
        chapterById.set(created.id, created);
      }
    }
  }

  return serializePlotToMarkdown(working);
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
  return formatEntityMarkdown(
    markdown,
    parsePlotMarkdown,
    serializePlotToMarkdown
  );
}
