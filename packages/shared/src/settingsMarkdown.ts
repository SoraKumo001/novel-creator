/**
 * 設定（settings）をマークダウン文書として直列化・解析するユーティリティ。
 *
 * マークダウン構造の規約:
 * - `# カテゴリ`  = 設定のカテゴリ（level 1 見出し）
 * - `## 名前`     = 設定の名前（level 2 見出し）
 * - 見出しに続く本文 = 設定の description
 *
 * コードフェンス（``` ``` ```）内の `#` は見出しとして誤認しないよう、
 * 行スキャン時にフェンス状態を追跡する。
 */

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
export interface SettingCategoryNode {
  category: string;
  /** カテゴリ見出しの 0 始まり行番号。 */
  headingLine: number;
  children: { name: string; headingLine: number }[];
}

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

  const lines: string[] = [];
  let currentCategory = '';

  for (const s of sorted) {
    if (s.category !== currentCategory) {
      if (lines.length > 0) lines.push('');
      lines.push(`# ${s.category}`);
      lines.push('');
      currentCategory = s.category;
    }
    lines.push(`## ${s.name}`);
    lines.push('');
    const desc = (s.description ?? '').trim();
    if (desc) {
      lines.push(desc);
    }
    lines.push('');
  }

  // 末尾の空行を除去しつつ、改行で終端
  return lines.join('\n').replace(/\n+$/, '\n');
}

/**
 * マークダウン文書を解析して設定セクション配列を返す。
 *
 * コードフェンス内の `#` / `##` は見出しとして扱わない。
 * 同一 (category, name) が複数回出現した場合は最初の出現を採用し、
 * 重複分は無視する（呼び出し側で警告可能）。
 */
export function parseSettingsMarkdown(markdown: string): ParsedSettingSection[] {
  const lines = markdown.split('\n');
  const sections: ParsedSettingSection[] = [];
  const seen = new Set<string>();

  let currentCategory = '';
  let inFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // コードフェンス状態追跡
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

    // level 2 見出し = 設定名
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      const name = h2[1].trim();
      const key = `${currentCategory}\u0000${name}`;
      if (currentCategory && !seen.has(key)) {
        seen.add(key);
        // 本文を収集: 次の見出し（# or ##）または文書末まで
        const bodyLines: string[] = [];
        let j = i + 1;
        let bodyInFence = false;
        while (j < lines.length) {
          const bodyLine = lines[j];
          if (/^\s*```/.test(bodyLine)) {
            bodyInFence = !bodyInFence;
            bodyLines.push(bodyLine);
            j++;
            continue;
          }
          if (!bodyInFence && /^(#{1,2})\s+/.test(bodyLine)) break;
          bodyLines.push(bodyLine);
          j++;
        }
        // 末尾の空行を除去
        while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
          bodyLines.pop();
        }
        // 先頭の空行を除去（見出し直後の空行）
        while (bodyLines.length > 0 && bodyLines[0].trim() === '') {
          bodyLines.shift();
        }
        sections.push({
          category: currentCategory,
          name,
          description: bodyLines.join('\n'),
        });
      }
      i++;
      continue;
    }

    i++;
  }

  return sections;
}

/**
 * マークダウン文書からセクションの行範囲情報を抽出する。
 *
 * フォーカストラッキング用: カーソル行を含むセクションを特定するために使う。
 */
export function getMarkdownSections(markdown: string): SettingSectionRange[] {
  const lines = markdown.split('\n');
  const ranges: SettingSectionRange[] = [];
  let currentCategory = '';
  let currentCategoryLine = -1;
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

    const h1 = /^#\s+(.+?)\s*$/.exec(line);
    if (h1) {
      currentCategory = h1[1].trim();
      currentCategoryLine = i;
      i++;
      continue;
    }

    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      const name = h2[1].trim();
      if (currentCategory) {
        const headingLine = i;
        let j = i + 1;
        let bodyInFence = false;
        const bodyLines: string[] = [];
        let firstBodyLine = -1;
        let lastBodyLine = -1;
        while (j < lines.length) {
          const bodyLine = lines[j];
          if (/^\s*```/.test(bodyLine)) {
            bodyInFence = !bodyInFence;
            if (firstBodyLine === -1) firstBodyLine = j;
            lastBodyLine = j;
            bodyLines.push(bodyLine);
            j++;
            continue;
          }
          if (!bodyInFence && /^(#{1,2})\s+/.test(bodyLine)) {
            break;
          }
          if (bodyLine.trim() !== '') {
            if (firstBodyLine === -1) firstBodyLine = j;
            lastBodyLine = j;
          }
          bodyLines.push(bodyLine);
          j++;
        }
        // 末尾の空行を本文から除外
        while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
          bodyLines.pop();
        }
        // 先頭の空行を本文から除外
        while (bodyLines.length > 0 && bodyLines[0].trim() === '') {
          bodyLines.shift();
        }
        const startLine = firstBodyLine === -1 ? i + 1 : firstBodyLine;
        const endLine = lastBodyLine === -1 ? startLine - 1 : lastBodyLine;
        ranges.push({
          category: currentCategory,
          name,
          headingLine,
          startLine,
          endLine: Math.max(endLine, startLine - 1),
          description: bodyLines.join('\n'),
        });
      }
      i++;
      continue;
    }

    i++;
  }

  // currentCategoryLine は未使用だが、将来の拡張（カテゴリ全体へのジャンプ等）のために保持
  void currentCategoryLine;

  return ranges;
}

/**
 * マークダウン文書からカテゴリツリーを構築する。
 *
 * ツリー表示用: カテゴリ → 設定名の階層。
 */
export function buildSettingTree(markdown: string): SettingCategoryNode[] {
  const lines = markdown.split('\n');
  const tree: SettingCategoryNode[] = [];
  let currentCategory: SettingCategoryNode | null = null;
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
 * 見出し行自体にカーソルがある場合はそのセクションを返す。
 * どのセクションにも属さない行（カテゴリ見出し前行など）は null を返す。
 */
export function findSectionAtLine(
  markdown: string,
  lineNumber: number,
): SettingSectionRange | null {
  const sections = getMarkdownSections(markdown);
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
 * 既存設定と解析結果を (category, name) で突き合わせ、
 * 追加・更新・削除すべき設定を分類する。
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
  const existingMap = new Map<string, (typeof existing)[number]>();
  for (const e of existing) {
    existingMap.set(`${e.category}\u0000${e.name}`, e);
  }

  const parsedMap = new Map<string, ParsedSettingSection>();
  let duplicateCount = 0;
  for (const p of parsed) {
    const key = `${p.category}\u0000${p.name}`;
    if (parsedMap.has(key)) {
      duplicateCount++;
      continue;
    }
    parsedMap.set(key, p);
  }

  const toCreate: ParsedSettingSection[] = [];
  const toUpdate: SettingsDiff['toUpdate'] = [];

  for (const [key, p] of parsedMap) {
    const ex = existingMap.get(key);
    if (!ex) {
      toCreate.push(p);
    } else {
      const exDesc = (ex.description ?? '').trim();
      const newDesc = p.description.trim();
      if (exDesc !== newDesc) {
        toUpdate.push({
          id: ex.id,
          category: p.category,
          name: p.name,
          description: p.description,
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
