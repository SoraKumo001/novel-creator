/**
 * 設定（settings）をマークダウン文書として直列化・解析するユーティリティ。
 *
 * マークダウン構造の規約:
 * - `# カテゴリ`  = 設定のカテゴリ（level 1 見出し）
 * - `## 名前`     = 設定の名前（level 2 見出し）
 * - 見出しに続く本文 = 設定の description
 */

import {
  buildMarkdownCategoryTree,
  calculateEntityDiff,
  findSectionByLine,
  scanMarkdownSections,
  trimAndJoinLines,
  writeMarkdownEntitySections,
  type MarkdownCategoryNode,
} from './markdownCore.js';

/** マークダウン解析後の設定セクション。 */
export interface ParsedSettingSection {
  category: string;
  name: string;
  description: string;
}

/** フォーカストラッキング用のセクション情報（行範囲付き）。 */
export interface SettingSectionRange {
  category: string;
  name: string;
  /** `##` 見出し行の 0 始まり行番号。 */
  headingLine: number;
  /** 本文開始行（見出しの次行）の 0 始まり行番号。 */
  startLine: number;
  /** 本文終端行（次の見出しの前行、または文書末尾）の 0 始まり行番号（含む）。 */
  endLine: number;
  /** セクション本文。 */
  description: string;
}

/** カテゴリごとのツリーノード。 */
export type SettingCategoryNode = MarkdownCategoryNode;

/**
 * 設定リストを単一のマークダウン文書に直列化する。
 *
 * 同一カテゴリの設定は連続して配置し、カテゴリ見出しの重複を避ける。
 * カテゴリ・名前の順で安定ソートする。
 */
export function serializeSettingsToMarkdown(
  settings: { category: string; name: string; description?: string | null }[],
): string {
  if (settings.length === 0) return '';

  const sorted = [...settings].sort((a, b) => {
    const c = a.category.localeCompare(b.category, 'ja');
    return c !== 0 ? c : a.name.localeCompare(b.name, 'ja');
  });

  return writeMarkdownEntitySections(sorted, {
    categoryOf: (s) => s.category,
    nameOf: (s) => s.name,
    writeBody: (s, lines) => {
      lines.push('');
      const desc = (s.description ?? '').trim();
      if (desc) {
        lines.push(desc);
      }
      lines.push('');
    },
  });
}

/**
 * マークダウン文書を解析して設定セクション配列を返す。
 */
export function parseSettingsMarkdown(markdown: string): ParsedSettingSection[] {
  const rawSections = scanMarkdownSections(markdown);
  const sections: ParsedSettingSection[] = [];
  const seen = new Set<string>();

  for (const raw of rawSections) {
    const key = `${raw.category}\u0000${raw.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      sections.push({
        category: raw.category,
        name: raw.name,
        description: trimAndJoinLines(raw.bodyLines),
      });
    }
  }

  return sections;
}

/**
 * マークダウン文書からセクションの行範囲情報を抽出する。
 *
 * フォーカストラッキング用: カーソル行を含むセクションを特定するために使う。
 */
export function getMarkdownSections(markdown: string): SettingSectionRange[] {
  const rawSections = scanMarkdownSections(markdown);
  return rawSections.map((raw) => ({
    category: raw.category,
    name: raw.name,
    headingLine: raw.headingLine,
    startLine: raw.startLine,
    endLine: raw.endLine,
    description: trimAndJoinLines(raw.bodyLines),
  }));
}

/**
 * マークダウン文書からカテゴリツリーを構築する。
 */
export function buildSettingTree(markdown: string): SettingCategoryNode[] {
  return buildMarkdownCategoryTree(markdown);
}

/**
 * 指定行番号を含むセクションを返す。
 */
export function findSectionAtLine(
  markdown: string,
  lineNumber: number,
): SettingSectionRange | null {
  const sections = getMarkdownSections(markdown);
  return findSectionByLine(sections, lineNumber);
}

/**
 * 保存時の差分を計算する。
 */
export interface SettingsDiff {
  /** 新規作成すべき設定。 */
  toCreate: ParsedSettingSection[];
  /** 更新すべき設定（description が変化したもの）。 */
  toUpdate: { id: string; category: string; name: string; description: string }[];
  /** 削除すべき設定の id。 */
  toDelete: string[];
  /** 同一 (category, name) で重複出現した件数。 */
  duplicateCount: number;
}

export function diffSettings(
  existing: { id: string; category: string; name: string; description?: string | null }[],
  parsed: ParsedSettingSection[],
): SettingsDiff {
  return calculateEntityDiff(
    existing,
    parsed,
    (ex, p) => (ex.description ?? '').trim() !== p.description.trim(),
    (ex, p) => ({
      id: ex.id,
      category: p.category,
      name: p.name,
      description: p.description,
    }),
  );
}
