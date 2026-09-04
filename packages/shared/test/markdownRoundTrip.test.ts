import { describe, expect, it } from "vitest";
import {
  applyStoryOutlineSectionUpdate,
  buildMarkdownCategoryTree,
  formatMarkdownDocument,
  parseCharactersMarkdown,
  parseForeshadowingsMarkdown,
  parsePlotMarkdown,
  parseSettingsMarkdown,
  parseTimelinesMarkdown,
  scanMarkdownSections,
  scanStoryOutlineSectionRanges,
  serializeCharactersToMarkdown,
  serializeForeshadowingsToMarkdown,
  serializePlotToMarkdown,
  serializeSettingsToMarkdown,
  serializeTimelinesToMarkdown,
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

describe("エンティティ round-trip 回帰 (serialize → parse → serialize)", () => {
  it("settings: 往復で内容と再直列化が安定すること", () => {
    const items = [
      {
        category: "世界観",
        description: "属性魔法が存在する。",
        name: "魔法体系",
      },
      {
        category: "地理",
        description: "中央に位置する城塞都市。",
        name: "王都",
      },
    ];
    const once = serializeSettingsToMarkdown(items);
    const parsed = parseSettingsMarkdown(once);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      category: "世界観",
      description: "属性魔法が存在する。",
      name: "魔法体系",
    });
    expect(serializeSettingsToMarkdown(parsed)).toBe(once);
  });

  it("characters: description / traits / relationships が往復で保持されること", () => {
    const items = [
      {
        category: "主要人物",
        description: "異世界から召喚された少年。",
        name: "主人公",
        relationships: "ヒロインの幼馴染。",
        traits: ["勇敢", "お人好し"],
      },
    ];
    const once = serializeCharactersToMarkdown(items);
    const parsed = parseCharactersMarkdown(once);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      category: "主要人物",
      description: "異世界から召喚された少年。",
      name: "主人公",
      relationships: "ヒロインの幼馴染。",
      traits: ["勇敢", "お人好し"],
    });
    expect(serializeCharactersToMarkdown(parsed)).toBe(once);
  });

  it("timelines: order / timestamp / sectionId メタが往復で保持されること", () => {
    const items = [
      {
        event: "魔王の封印",
        order: 1,
        sectionId: "sec-1",
        timestamp: "帝都暦700年",
      },
      {
        event: "勇者の誕生",
        order: 2,
        sectionId: null,
        timestamp: "帝都暦720年",
      },
    ];
    const once = serializeTimelinesToMarkdown(items);
    const parsed = parseTimelinesMarkdown(once);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      event: "魔王の封印",
      order: 1,
      sectionId: "sec-1",
      timestamp: "帝都暦700年",
    });
    expect(parsed[1]).toMatchObject({
      event: "勇者の誕生",
      order: 2,
      timestamp: "帝都暦720年",
    });
    expect(serializeTimelinesToMarkdown(parsed)).toBe(once);
  });

  it("foreshadowings: status / placed / resolved メタが往復で保持されること", () => {
    const items = [
      {
        category: "主要伏線",
        description: "古代魔法の紋章が刻まれている。",
        placedSectionId: "sec-a",
        resolvedSectionId: null,
        status: "unresolved" as const,
        title: "ペンダントの秘密",
      },
      {
        category: "主要伏線",
        description: "宰相の怪しい動き。",
        placedSectionId: null,
        resolvedSectionId: "sec-z",
        status: "resolved" as const,
        title: "王都の黒幕",
      },
    ];
    const once = serializeForeshadowingsToMarkdown(items);
    const parsed = parseForeshadowingsMarkdown(once);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      placedSectionId: "sec-a",
      status: "unresolved",
      title: "ペンダントの秘密",
    });
    expect(parsed[1]).toMatchObject({
      resolvedSectionId: "sec-z",
      status: "resolved",
      title: "王都の黒幕",
    });
    expect(serializeForeshadowingsToMarkdown(parsed)).toBe(once);
  });

  it("plot: 章・節構造が往復で保持されること", () => {
    const chapters = [
      {
        order: 1,
        sections: [
          { order: 1, summary: "旅立ちの朝。", title: "出発" },
          { order: 2, summary: "森での戦い。", title: "試練" },
        ],
        summary: "導入章。",
        title: "第一章",
      },
      {
        order: 2,
        sections: [{ order: 1, summary: "決戦。", title: "対決" }],
        summary: "決着章。",
        title: "最終章",
      },
    ];
    const once = serializePlotToMarkdown(chapters);
    const parsed = parsePlotMarkdown(once);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("第一章");
    expect(parsed[0].sections.map((s) => s.title)).toEqual(["出発", "試練"]);
    expect(serializePlotToMarkdown(parsed)).toBe(once);
  });

  it("storyOutline: セクション走査と更新が往復で保持されること", () => {
    const md = "# 全体あらすじ\n\n物語の概要。\n\n## 結末\n\n終わり。\n";
    const ranges = scanStoryOutlineSectionRanges(md);
    expect(ranges.map((r) => r.name)).toEqual(["結末"]);
    expect(ranges[0].content).toBe("終わり。");
    const updated = applyStoryOutlineSectionUpdate(
      md,
      "結末",
      "新しい終わり。"
    );
    expect(updated.updatedMarkdown).toContain("新しい終わり。");
    const reparsed = scanStoryOutlineSectionRanges(updated.updatedMarkdown);
    expect(reparsed[0].content).toBe("新しい終わり。");
  });

  it("重複セクションは先勝ちで1件のみパースされること", () => {
    const md = "# 世界観\n\n## 魔法体系\n\n最初。\n\n## 魔法体系\n\n二番目。\n";
    const parsed = parseSettingsMarkdown(md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].description).toBe("最初。");
  });
});
