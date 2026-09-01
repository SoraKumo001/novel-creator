/**
 * カテゴリの複数階層（スラッシュ区切り）パース・ツリー構築ユーティリティ
 */

export interface CategoryTreeNode<T> {
  /** 子カテゴリノード */
  children: CategoryTreeNode<T>[];
  /** ルートからのフルパス（スラッシュ区切り。例: "採取ギルド / 採取メンバー"） */
  fullPath: string;
  /** このカテゴリ階層に直接属するアイテム */
  items: T[];
  /** 階層の深さ (0: トップレベル) */
  level: number;
  /** 現在の階層名（例: "採取メンバー"） */
  name: string;
  /** 直下および子孫カテゴリの全アイテム合計件数 */
  totalCount: number;
}

/**
 * カテゴリ文字列をスラッシュまたは全角スラッシュで分割し、階層セグメントの配列に正規化する。
 * 空白や空文字は除外される。
 * 例: "採取ギルド / 採取メンバー" -> ["採取ギルド", "採取メンバー"]
 * 例: "" または null -> ["未分類"]
 */
export function parseCategoryPath(category?: string | null): string[] {
  if (!category) {
    return ["未分類"];
  }
  const segments = category
    .split(/[/／]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments : ["未分類"];
}

/**
 * 階層セグメント配列を標準的なスラッシュ区切り文字列に戻す。
 * 例: ["採取ギルド", "採取メンバー"] -> "採取ギルド / 採取メンバー"
 */
export function formatCategoryPath(segments: readonly string[]): string {
  if (segments.length === 0) {
    return "未分類";
  }
  return segments.join(" / ");
}

export type CategorySortOption =
  | "category-asc-name-asc"
  | "category-asc-name-desc"
  | "category-desc-name-asc"
  | "category-desc-name-desc"
  | "name-asc"
  | "name-desc";

/**
 * エンティティ配列から複数階層のカテゴリツリーを構築する。
 */
export function buildCategoryTree<T extends { name: string }>(
  items: readonly T[],
  categoryOf: (item: T) => string | null | undefined,
  sortOption: CategorySortOption = "category-asc-name-asc"
): CategoryTreeNode<T>[] {
  const rootNodes: CategoryTreeNode<T>[] = [];

  for (const item of items) {
    const rawCat = categoryOf(item);
    const segments = parseCategoryPath(rawCat);

    let currentLevelNodes = rootNodes;
    const accumulatedPathSegments: string[] = [];

    for (let depth = 0; depth < segments.length; depth++) {
      const segmentName = segments[depth];
      accumulatedPathSegments.push(segmentName);
      const fullPath = formatCategoryPath(accumulatedPathSegments);
      const isLeaf = depth === segments.length - 1;

      let targetNode = currentLevelNodes.find((n) => n.name === segmentName);
      if (!targetNode) {
        targetNode = {
          children: [],
          fullPath,
          items: [],
          level: depth,
          name: segmentName,
          totalCount: 0,
        };
        currentLevelNodes.push(targetNode);
      }

      if (isLeaf) {
        targetNode.items.push(item);
      }

      currentLevelNodes = targetNode.children;
    }
  }

  // 各ノードのアイテムソート、子ノードソート、totalCount 計算を再帰的に実行
  function processNode(node: CategoryTreeNode<T>): void {
    // アイテムのソート
    node.items.sort((a, b) => {
      if (sortOption.endsWith("desc")) {
        return b.name.localeCompare(a.name, "ja");
      }
      return a.name.localeCompare(b.name, "ja");
    });

    // 子ノードの再帰処理
    for (const child of node.children) {
      processNode(child);
    }

    // 子ノード自体のソート
    node.children.sort((a, b) => {
      if (sortOption.startsWith("category-desc")) {
        return b.name.localeCompare(a.name, "ja");
      }
      return a.name.localeCompare(b.name, "ja");
    });

    // 合計件数
    node.totalCount =
      node.items.length +
      node.children.reduce((sum, c) => sum + c.totalCount, 0);
  }

  for (const root of rootNodes) {
    processNode(root);
  }

  // ルートノードのソート
  rootNodes.sort((a, b) => {
    // 「未分類」は常に最後に配置
    if (a.name === "未分類") {
      return 1;
    }
    if (b.name === "未分類") {
      return -1;
    }
    if (sortOption.startsWith("category-desc")) {
      return b.name.localeCompare(a.name, "ja");
    }
    return a.name.localeCompare(b.name, "ja");
  });

  return rootNodes;
}

/**
 * カテゴリツリーを深さ優先で平坦化（フラットなリスト）にし、カード表示用のセクション配列等に変換する。
 */
export function flattenCategoryTree<T>(
  nodes: readonly CategoryTreeNode<T>[]
): CategoryTreeNode<T>[] {
  const result: CategoryTreeNode<T>[] = [];

  function traverse(node: CategoryTreeNode<T>) {
    // アイテムが存在するか、または子ノードが存在する場合にセクションとして含める
    if (node.items.length > 0 || node.children.length > 0) {
      result.push(node);
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return result;
}
