/**
 * Markdown パース・走査・差分計算の共通コアモジュール。
 *
 * 設定（settings）や人物（characters）など、`# カテゴリ` / `## 名前` 構造を持つ
 * マークダウン文書の共通走査・ツリー構築・差分計算を提供します。
 */

/** カテゴリツリーのノード定義 */
export interface MarkdownCategoryNode {
  category: string;
  headingLine: number;
  children: { name: string; headingLine: number }[];
}

/** Markdown から抽出された未加工セクション */
export interface RawMarkdownSection {
  category: string;
  name: string;
  headingLine: number;
  startLine: number;
  endLine: number;
  bodyLines: string[];
}

/**
 * マークダウンを行単位で走査し、`# カテゴリ` と `## 名前` ごとのセクションを抽出する。
 * コードフェンス内の `#` / `##` は見出しとして扱わない。
 */
export function scanMarkdownSections(markdown: string): RawMarkdownSection[] {
  const lines = markdown.split('\n');
  const sections: RawMarkdownSection[] = [];
  let currentCategory = '';
  let inFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // コードフェンス状態の追跡
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

    // level 2 見出し = 項目名
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      const name = h2[1].trim();
      if (currentCategory) {
        const headingLine = i;
        const startLine = i + 1;
        let endLine = lines.length - 1;
        let j = i + 1;
        let bodyInFence = false;
        const bodyLines: string[] = [];

        while (j < lines.length) {
          const bodyLine = lines[j];
          if (/^\s*```/.test(bodyLine)) {
            bodyInFence = !bodyInFence;
            bodyLines.push(bodyLine);
            j++;
            continue;
          }
          if (!bodyInFence && /^(#{1,2})\s+/.test(bodyLine)) {
            endLine = j - 1;
            break;
          }
          bodyLines.push(bodyLine);
          j++;
        }
        if (j >= lines.length) {
          endLine = lines.length - 1;
        }

        sections.push({
          category: currentCategory,
          name,
          headingLine,
          startLine,
          endLine: Math.max(endLine, startLine - 1),
          bodyLines,
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
 * マークダウン文書からカテゴリツリーを構築する。
 */
export function buildMarkdownCategoryTree(markdown: string): MarkdownCategoryNode[] {
  const lines = markdown.split('\n');
  const tree: MarkdownCategoryNode[] = [];
  let currentCategory: MarkdownCategoryNode | null = null;
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
 */
export function findSectionByLine<T extends { headingLine: number; endLine: number }>(
  sections: T[],
  lineNumber: number,
): T | null {
  for (const s of sections) {
    if (lineNumber >= s.headingLine && lineNumber <= s.endLine) {
      return s;
    }
  }
  return null;
}

/**
 * 汎用的なエンティティ差分計算。
 * (category, name) の複合キーで照合し、作成・更新・削除・重複を算出します。
 */
export function calculateEntityDiff<
  TExisting extends { id: string; category?: string | null; name: string },
  TParsed extends { category: string; name: string },
  TUpdate,
>(
  existing: TExisting[],
  parsed: TParsed[],
  isChanged: (ex: TExisting, p: TParsed) => boolean,
  buildUpdate: (ex: TExisting, p: TParsed) => TUpdate,
): {
  toCreate: TParsed[];
  toUpdate: TUpdate[];
  toDelete: string[];
  duplicateCount: number;
} {
  const existingMap = new Map<string, TExisting>();
  for (const e of existing) {
    const cat = (e.category ?? '未分類').trim() || '未分類';
    existingMap.set(`${cat}\u0000${e.name}`, e);
  }

  const parsedMap = new Map<string, TParsed>();
  let duplicateCount = 0;
  for (const p of parsed) {
    const cat = (p.category ?? '未分類').trim() || '未分類';
    const key = `${cat}\u0000${p.name}`;
    if (parsedMap.has(key)) {
      duplicateCount++;
      continue;
    }
    parsedMap.set(key, p);
  }

  const toCreate: TParsed[] = [];
  const toUpdate: TUpdate[] = [];

  for (const [key, p] of parsedMap) {
    const ex = existingMap.get(key);
    if (!ex) {
      toCreate.push(p);
    } else if (isChanged(ex, p)) {
      toUpdate.push(buildUpdate(ex, p));
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

/**
 * 行配列の前後の空行を除去してテキストを結合するヘルパー
 */
export function trimAndJoinLines(lines: string[]): string {
  const cloned = [...lines];
  while (cloned.length > 0 && cloned[cloned.length - 1].trim() === '') {
    cloned.pop();
  }
  while (cloned.length > 0 && cloned[0].trim() === '') {
    cloned.shift();
  }
  return cloned.join('\n');
}
