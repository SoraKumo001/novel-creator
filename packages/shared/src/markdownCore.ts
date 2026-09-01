/**
 * Markdown パース・走査・差分計算の共通コアモジュール。
 *
 * 設定（settings）や人物（characters）など、`# カテゴリ` / `## 名前` 構造を持つ
 * マークダウン文書の共通走査・ツリー構築・差分計算を提供します。
 */

/** カテゴリツリーのノード定義 */
export interface MarkdownCategoryNode {
  category: string;
  children: { name: string; headingLine: number }[];
  headingLine: number;
}

/** Markdown から抽出された未加工セクション */
export interface RawMarkdownSection {
  bodyLines: string[];
  category: string;
  endLine: number;
  headingLine: number;
  name: string;
  startLine: number;
}

/**
 * マークダウンを行単位で走査し、`# カテゴリ` と `## 名前` ごとのセクションを抽出する。
 * コードフェンス内の `#` / `##` は見出しとして扱わない。
 */
export function scanMarkdownSections(markdown: string): RawMarkdownSection[] {
  const lines = markdown.split("\n");
  const sections: RawMarkdownSection[] = [];
  let currentCategory = "";
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
          bodyLines,
          category: currentCategory,
          endLine: Math.max(endLine, startLine - 1),
          headingLine,
          name,
          startLine,
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
export function buildMarkdownCategoryTree(
  markdown: string
): MarkdownCategoryNode[] {
  const lines = markdown.split("\n");
  const tree: MarkdownCategoryNode[] = [];
  let currentCategory: MarkdownCategoryNode | null = null;
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    const h1 = /^#\s+(.+?)\s*$/.exec(line);
    if (h1) {
      currentCategory = {
        category: h1[1].trim(),
        children: [],
        headingLine: i,
      };
      tree.push(currentCategory);
      continue;
    }

    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2 && currentCategory) {
      currentCategory.children.push({ headingLine: i, name: h2[1].trim() });
    }
  }

  return tree;
}

/**
 * 指定行番号を含むセクションを返す。
 */
export function findSectionByLine<
  T extends { headingLine: number; endLine: number },
>(sections: T[], lineNumber: number): T | null {
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
  buildUpdate: (ex: TExisting, p: TParsed) => TUpdate
): {
  toCreate: TParsed[];
  toUpdate: TUpdate[];
  toDelete: string[];
  duplicateCount: number;
} {
  const existingMap = new Map<string, TExisting>();
  for (const e of existing) {
    const cat = (e.category ?? "未分類").trim() || "未分類";
    existingMap.set(`${cat}\u0000${e.name}`, e);
  }

  const parsedMap = new Map<string, TParsed>();
  let duplicateCount = 0;
  for (const p of parsed) {
    const cat = (p.category ?? "未分類").trim() || "未分類";
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

  return { duplicateCount, toCreate, toDelete, toUpdate };
}

/** 共通 Markdown writer へのオプション定義 */
export interface MarkdownEntitySectionWriterOptions<T> {
  /** エンティティのカテゴリ（`# カテゴリ` 見出しに使う文字列）を返す */
  categoryOf: (item: T) => string;
  /** エンティティの名前（`## 名前` 見出しに使う文字列）を返す */
  nameOf: (item: T) => string;
  /** `## 名前` 見出し直後の本文行を lines に書き込む（エンティティ固有の処理） */
  writeBody: (item: T, lines: string[]) => void;
}

/**
 * ソート済みエンティティのリストを `# カテゴリ` / `## 名前` 構造のマークダウンに直列化する共通 writer。
 *
 * - 同一カテゴリのエンティティは連続配置し、カテゴリ見出しの重複を避ける
 * - カテゴリ見出しが切り替わる直前に空行を挿入する
 * - 末尾の空行を除去した上で改行で終端する
 *
 * ソートは呼び出し側で行うこと（カテゴリの正規化やソートキーがエンティティ固有のため）。
 * エンティティ固有の本文（サブセクション等）は writeBody に委譲する。
 */
export function writeMarkdownEntitySections<T>(
  sortedItems: T[],
  options: MarkdownEntitySectionWriterOptions<T>
): string {
  if (sortedItems.length === 0) {
    return "";
  }

  const lines: string[] = [];
  let currentCategory = "";

  for (const item of sortedItems) {
    const category = options.categoryOf(item);
    if (category !== currentCategory) {
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(`# ${category}`);
      lines.push("");
      currentCategory = category;
    }
    lines.push(`## ${options.nameOf(item)}`);
    options.writeBody(item, lines);
  }

  return lines.join("\n").replace(/\n+$/, "\n");
}

/**
 * 行配列の前後の空行を除去してテキストを結合するヘルパー
 */
export function trimAndJoinLines(lines: string[]): string {
  const cloned = [...lines];
  while (cloned.length > 0 && cloned.at(-1)?.trim() === "") {
    cloned.pop();
  }
  while (cloned.length > 0 && cloned[0].trim() === "") {
    cloned.shift();
  }
  return cloned.join("\n");
}
