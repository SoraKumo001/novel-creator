import { describe, expect, it } from "vitest";
import {
  parseCharactersMarkdown,
  parseForeshadowingsMarkdown,
  parseSettingsMarkdown,
  serializeCharactersToMarkdown,
  serializeForeshadowingsToMarkdown,
  serializeSettingsToMarkdown,
  writeMarkdownEntitySections,
} from "../src/index.js";

/**
 * 共通 Markdown writer（writeMarkdownEntitySections）と
 * 3つの serializer（settings / characters / foreshadowings）の
 * バイト互換（serialize → parse → serialize で同一出力）を固定するテスト。
 */
describe("writeMarkdownEntitySections（共通 writer）", () => {
  it("空リストは空文字列を返すこと", () => {
    expect(
      writeMarkdownEntitySections([], {
        categoryOf: () => "A",
        nameOf: () => "x",
        writeBody: () => {},
      })
    ).toBe("");
  });

  it("カテゴリ見出しの重複を避け、切り替わり直前に空行を挿入すること", () => {
    const md = writeMarkdownEntitySections(
      [
        { category: "A", name: "x1" },
        { category: "A", name: "x2" },
        { category: "B", name: "y1" },
      ],
      {
        categoryOf: (item) => item.category,
        nameOf: (item) => item.name,
        writeBody: () => {},
      }
    );
    // writeBody が何も書き込まない場合、本文・末尾の空行は付かない
    expect(md).toBe("# A\n\n## x1\n## x2\n\n# B\n\n## y1");
  });
});

describe("Markdown 出力のバイト互換（settings）", () => {
  it("説明の有無・空白のみの説明・末尾改行が期待どおりであること", () => {
    expect(
      serializeSettingsToMarkdown([
        { category: "A", description: "中央に位置する。", name: "王都" },
        { category: "A", description: null, name: "村" },
        { category: "B", description: "   ", name: "魔法" },
      ])
    ).toBe(
      "# A\n\n## 王都\n\n中央に位置する。\n\n## 村\n\n\n\n# B\n\n## 魔法\n"
    );
  });

  it("空リストは空文字列であること", () => {
    expect(serializeSettingsToMarkdown([])).toBe("");
  });

  it("serialize → parse → serialize で同一出力になること", () => {
    const md = serializeSettingsToMarkdown([
      {
        category: "世界観",
        description: "属性魔法が存在する。\n複数行の説明。",
        name: "魔法体系",
      },
      {
        category: "地理",
        description: "中央に位置する城塞都市。",
        name: "王都",
      },
      { category: "地理", description: null, name: "辺境の村" },
    ]);
    expect(serializeSettingsToMarkdown(parseSettingsMarkdown(md))).toBe(md);
  });
});

describe("Markdown 出力のバイト互換（characters）", () => {
  it("サブセクション（### 特徴 / ### 関係性）と空項目を含む出力が期待どおりであること", () => {
    expect(
      serializeCharactersToMarkdown([
        {
          category: "B",
          description: "",
          name: "語り手",
          relationships: "",
          traits: [""],
        },
        {
          category: "A",
          description: "説明。",
          name: "主人公",
          relationships: "ヒロインの幼馴染。",
          traits: ["勇敢", "  "],
        },
      ])
    ).toBe(
      "# A\n\n## 主人公\n\n説明。\n\n### 特徴\n\n- 勇敢\n\n### 関係性\n\nヒロインの幼馴染。\n\n\n# B\n\n## 語り手\n"
    );
  });

  it("category が null の場合は未分類になること", () => {
    expect(
      serializeCharactersToMarkdown([
        {
          category: null,
          description: "説明",
          name: "X",
          relationships: null,
          traits: null,
        },
      ])
    ).toBe("# 未分類\n\n## X\n\n説明\n");
  });

  it("serialize → parse → serialize で同一出力になること", () => {
    const md = serializeCharactersToMarkdown([
      {
        category: "主要人物",
        description: "異世界から召喚された少年。",
        name: "主人公",
        relationships: "ヒロインの幼馴染。",
        traits: ["勇敢", "お人好し"],
      },
      {
        category: "主要人物",
        description: null,
        name: "ヒロイン",
        relationships: { 立場: "幼馴染" },
        traits: null,
      },
      {
        category: "脇役",
        description: "賢者。",
        name: "老人",
        relationships: "",
        traits: [],
      },
    ]);
    expect(serializeCharactersToMarkdown(parseCharactersMarkdown(md))).toBe(md);
  });
});

describe("Markdown 出力のバイト互換（foreshadowings）", () => {
  it("メタコメント・未分類・空説明を含む出力が期待どおりであること", () => {
    expect(
      serializeForeshadowingsToMarkdown([
        {
          category: "B",
          description: null,
          placedSectionId: null,
          resolvedSectionId: null,
          status: null,
          title: "未配置の伏線",
        },
        {
          category: "A",
          description: "秘密。",
          placedSectionId: "sec-1",
          resolvedSectionId: "sec-2",
          status: "resolved",
          title: "ペンダントの秘密",
        },
      ])
    ).toBe(
      "# A\n\n## ペンダントの秘密\n<!-- status: resolved, placed: sec-1, resolved: sec-2 -->\n\n秘密。\n\n\n# B\n\n## 未配置の伏線\n<!-- status: unresolved -->\n"
    );
  });

  it("serialize → parse → serialize で同一出力になること", () => {
    const md = serializeForeshadowingsToMarkdown([
      {
        category: "主要伏線 / 主人公の謎",
        description: "幼少期から所持している銀のペンダント。",
        placedSectionId: "sec-1",
        resolvedSectionId: null,
        status: "unresolved",
        title: "ペンダントの秘密",
      },
      {
        category: null,
        description: "城の地下で目撃された。",
        placedSectionId: null,
        resolvedSectionId: "sec-9",
        status: "resolved",
        title: "黒衣の人物",
      },
    ]);
    expect(
      serializeForeshadowingsToMarkdown(parseForeshadowingsMarkdown(md))
    ).toBe(md);
  });
});
