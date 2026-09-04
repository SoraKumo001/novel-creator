import { describe, expect, it } from "vitest";
import {
  buildMarkdownCategoryTree,
  formatMarkdownDocument,
  scanMarkdownSections,
} from "../src/index.js";

/**
 * 正規化（remark-stringify）の round-trip 保証テスト。
 * 使い分け: レンダラ=marked（表示）、整形/構造化=remark（本モジュール・各 format*Markdown）。将来一本化は保留。
 */
describe("formatMarkdownDocument round-trip", () => {
  it("ルビ記法（|漢字《よみ》・漢字《よみ》）を壊さないこと", () => {
    const md =
      "# A\n\n## x\n\n|漢字《かんじ》が本です。\n\n漢字《かんじ》も残る。\n";
    const out = formatMarkdownDocument(md);
    expect(out).toContain("|漢字《かんじ》");
    expect(out).toContain("漢字《かんじ》");
  });

  it("傍点記法（《《傍点》》）を壊さないこと", () => {
    const md = "# A\n\n## x\n\n《《秘密》》を守る。\n";
    expect(formatMarkdownDocument(md)).toContain("《《秘密》》");
  });

  it("mermaid フェンスを壊さないこと", () => {
    const md = "# A\n\n## x\n\n```mermaid\ngraph TD\nA-->B\n```\n";
    const out = formatMarkdownDocument(md);
    expect(out).toContain("```mermaid");
    expect(out).toContain("graph TD");
    expect(out).toContain("A-->B");
  });

  it("コードブロック内の # を書き換えないこと", () => {
    const md = "# A\n\n## x\n\n```txt\n# not heading\n```\n";
    const out = formatMarkdownDocument(md);
    expect(out).toContain("# not heading");
  });

  it("冪等性を満たすこと（format(format(x)) == format(x)）", () => {
    const md =
      "# A\n\n## x\n\n|漢字《かんじ》と《《秘密》》。\n\n```mermaid\ngraph TD\nA-->B\n```\n\n```txt\n# not heading\n```\n";
    const once = formatMarkdownDocument(md);
    expect(formatMarkdownDocument(once)).toBe(once);
  });
});

describe("フェンス内見出しの無視（scan/build）", () => {
  const md = "# A\n\n## x\n\n```txt\n# fake\n## fake2\n```\n\n## y\n本文\n";

  it("scanMarkdownSections がフェンス内見出しをセクション化しないこと", () => {
    const names = scanMarkdownSections(md).map((s) => s.name);
    expect(names).toEqual(["x", "y"]);
  });

  it("buildMarkdownCategoryTree がフェンス内見出しを拾わないこと", () => {
    const tree = buildMarkdownCategoryTree(md);
    expect(tree[0]?.children.map((c) => c.name)).toEqual(["x", "y"]);
  });
});
