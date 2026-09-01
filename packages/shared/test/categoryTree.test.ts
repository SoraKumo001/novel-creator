import { describe, expect, it } from "vitest";
import {
  buildCategoryTree,
  flattenCategoryTree,
  formatCategoryPath,
  parseCategoryPath,
} from "../src/categoryTree.js";

describe("categoryTree utility", () => {
  describe("parseCategoryPath", () => {
    it("スラッシュ区切りのパスを配列に分解すること", () => {
      expect(parseCategoryPath("採取ギルド / 採取メンバー")).toEqual([
        "採取ギルド",
        "採取メンバー",
      ]);
      expect(parseCategoryPath("採取ギルド/遠征隊/リーダー")).toEqual([
        "採取ギルド",
        "遠征隊",
        "リーダー",
      ]);
      expect(parseCategoryPath("世界観／魔法／火属性")).toEqual([
        "世界観",
        "魔法",
        "火属性",
      ]);
    });

    it("空文字や未設定時は未分類を返すこと", () => {
      expect(parseCategoryPath("")).toEqual(["未分類"]);
      expect(parseCategoryPath(null)).toEqual(["未分類"]);
      expect(parseCategoryPath(undefined)).toEqual(["未分類"]);
      expect(parseCategoryPath("   ")).toEqual(["未分類"]);
    });
  });

  describe("formatCategoryPath", () => {
    it("セグメント配列をスラッシュ区切り文字列に整形すること", () => {
      expect(formatCategoryPath(["採取ギルド", "採取メンバー"])).toBe(
        "採取ギルド / 採取メンバー"
      );
      expect(formatCategoryPath([])).toBe("未分類");
    });
  });

  describe("buildCategoryTree", () => {
    const characters = [
      { category: "採取ギルド / 採取メンバー", id: "1", name: "アイン" },
      { category: "採取ギルド / 採取メンバー", id: "2", name: "ロイク" },
      { category: "採取ギルド / 幹部 / ギルド長", id: "3", name: "ユーグ" },
      {
        category: "採取ギルド / 幹部 / 副ギルド長",
        id: "4",
        name: "セドリック",
      },
      { category: "騎士団 / 団長", id: "5", name: "アリオス" },
      { category: "未分類", id: "6", name: "ウォレン" },
    ];

    it("階層構造のツリーノードを正しく構築すること", () => {
      const tree = buildCategoryTree(characters, (c) => c.category);

      // トップレベルノード: 騎士団（き）, 採取ギルド（さ）, 未分類
      expect(tree.map((n) => n.name)).toEqual([
        "騎士団",
        "採取ギルド",
        "未分類",
      ]);

      const guildNode = tree.find((n) => n.name === "採取ギルド")!;
      expect(guildNode).toBeDefined();
      expect(guildNode.totalCount).toBe(4);
      expect(guildNode.children.map((c) => c.name)).toEqual([
        "幹部",
        "採取メンバー",
      ]);

      const memberNode = guildNode.children.find(
        (c) => c.name === "採取メンバー"
      )!;
      expect(memberNode.items.map((i) => i.name)).toEqual(["アイン", "ロイク"]);
      expect(memberNode.totalCount).toBe(2);

      const executiveNode = guildNode.children.find((c) => c.name === "幹部")!;
      expect(executiveNode.children.map((c) => c.name)).toEqual([
        "ギルド長",
        "副ギルド長",
      ]);
      expect(executiveNode.totalCount).toBe(2);

      const knightNode = tree.find((n) => n.name === "騎士団")!;
      expect(knightNode.totalCount).toBe(1);
    });

    it("flattenCategoryTree で深さ優先のセクションリストを取得できること", () => {
      const tree = buildCategoryTree(characters, (c) => c.category);
      const flattened = flattenCategoryTree(tree);

      expect(flattened.map((f) => f.fullPath)).toEqual([
        "騎士団",
        "騎士団 / 団長",
        "採取ギルド",
        "採取ギルド / 幹部",
        "採取ギルド / 幹部 / ギルド長",
        "採取ギルド / 幹部 / 副ギルド長",
        "採取ギルド / 採取メンバー",
        "未分類",
      ]);
    });
  });
});
