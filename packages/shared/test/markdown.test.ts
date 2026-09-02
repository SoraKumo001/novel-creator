import { describe, expect, it } from "vitest";
import {
  applyCharactersToMarkdown,
  buildCharacterTree,
  buildSettingTree,
  diffCharacters,
  diffSettings,
  findCharacterAtLine,
  findSectionAtLine,
  formatCharactersMarkdown,
  formatSettingsMarkdown,
  formatStoryOutlineMarkdown,
  parseCharactersMarkdown,
  parseSettingsMarkdown,
  serializeCharactersToMarkdown,
  serializeSettingsToMarkdown,
} from "../src/index.js";

describe("settingsMarkdown", () => {
  const sampleSettings = [
    {
      category: "世界観",
      description: "属性魔法が存在する。",
      name: "魔法体系",
    },
    { category: "地理", description: "中央に位置する城塞都市。", name: "王都" },
  ];

  it("設定をマークダウンにシリアライズできること", () => {
    const md = serializeSettingsToMarkdown(sampleSettings);
    expect(md).toContain("# 世界観");
    expect(md).toContain("## 魔法体系");
    expect(md).toContain("属性魔法が存在する。");
    expect(md).toContain("# 地理");
    expect(md).toContain("## 王都");
  });

  it("マークダウンから設定をパースできること", () => {
    const md =
      "# 世界観\n\n## 魔法体系\n\n属性魔法が存在する。\n\n# 地理\n\n## 王都\n\n中央に位置する城塞都市。";
    const parsed = parseSettingsMarkdown(md);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      category: "世界観",
      description: "属性魔法が存在する。",
      name: "魔法体系",
    });
    expect(parsed[1]).toEqual({
      category: "地理",
      description: "中央に位置する城塞都市。",
      name: "王都",
    });
  });

  it("コードフェンス内の見出しを無視すること", () => {
    const md =
      "# 世界観\n\n## 魔法体系\n\n```markdown\n# これは見出しではない\n## これも項目ではない\n```\n本文の続き。";
    const parsed = parseSettingsMarkdown(md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("魔法体系");
    expect(parsed[0].description).toContain("# これは見出しではない");
  });

  it("ツリー構造を正しく構築できること", () => {
    const md = "# 世界観\n\n## 魔法体系\n\n# 地理\n\n## 王都";
    const tree = buildSettingTree(md);
    expect(tree).toHaveLength(2);
    expect(tree[0].category).toBe("世界観");
    expect(tree[0].children[0].name).toBe("魔法体系");
  });

  it("行番号からセクションを検索できること", () => {
    const md =
      "# 世界観\n\n## 魔法体系\n\n属性魔法が存在する。\n\n# 地理\n\n## 王都";
    const found = findSectionAtLine(md, 2);
    expect(found).not.toBeNull();
    expect(found?.name).toBe("魔法体系");
  });

  it("差分（diffSettings）が正しく計算されること", () => {
    const existing = [
      {
        category: "世界観",
        description: "古い説明",
        id: "1",
        name: "魔法体系",
      },
      { category: "地理", description: "削除予定", id: "2", name: "旧都市" },
    ];
    const parsed = [
      { category: "世界観", description: "新しい説明", name: "魔法体系" },
      { category: "地理", description: "新規都市", name: "王都" },
    ];
    const diff = diffSettings(existing, parsed);
    expect(diff.toCreate).toHaveLength(1);
    expect(diff.toCreate[0].name).toBe("王都");
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].id).toBe("1");
    expect(diff.toUpdate[0].description).toBe("新しい説明");
    expect(diff.toDelete).toEqual(["2"]);
  });

  it("Mermaidブロックを含むdescriptionを正しくパースできること", () => {
    const md = [
      "# 地理",
      "",
      "## 大陸間の関係",
      "",
      "三大陸が海を挟んで鼎立する。交易路は南回りが主流。",
      "",
      "```mermaid",
      "graph TD",
      "    アストラ -->|北の海| ルミナ",
      "    ルミナ -->|東の海峡| オリン",
      "```",
      "",
      "## 王都アステル",
      "",
      "中央に位置する城塞都市。",
    ].join("\n");
    const parsed = parseSettingsMarkdown(md);
    expect(parsed).toHaveLength(2);

    expect(parsed[0].category).toBe("地理");
    expect(parsed[0].name).toBe("大陸間の関係");
    expect(parsed[0].description).toContain("三大陸が海を挟んで鼎立する。");
    // Mermaidブロック全体がdescriptionに保持されること
    expect(parsed[0].description).toContain("```mermaid");
    expect(parsed[0].description).toContain("graph TD");
    expect(parsed[0].description).toContain("アストラ");
    expect(parsed[0].description).toContain("```");

    // 次のセクションが正しく認識されること（フェンス終了後の ## 見出し）
    expect(parsed[1].name).toBe("王都アステル");
    expect(parsed[1].description).toBe("中央に位置する城塞都市。");
  });

  it("Mermaidブロック内の # / ## を見出しとして誤認しないこと", () => {
    const md = [
      "# 地理",
      "",
      "## 関係図",
      "",
      "```mermaid",
      "graph TD",
      "    A[都市A] --> B[都市B]",
      "    %% この # はコメント",
      "```",
      "",
      "## 隣接地域",
      "",
      "北側の山地。",
    ].join("\n");
    const parsed = parseSettingsMarkdown(md);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("関係図");
    expect(parsed[1].name).toBe("隣接地域");
  });

  it("Mermaidブロックを含む設定の差分が正しく計算されること", () => {
    const existing = [
      {
        category: "地理",
        description: "旧い説明\n\n```mermaid\ngraph TD\n    A-->B\n```",
        id: "1",
        name: "大陸間の関係",
      },
    ];
    const parsed = [
      {
        category: "地理",
        description:
          "三大陸が鼎立する。\n\n```mermaid\ngraph TD\n    アストラ-->ルミナ\n    ルミナ-->オリン\n```",
        name: "大陸間の関係",
      },
    ];
    const diff = diffSettings(existing, parsed);
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].id).toBe("1");
    expect(diff.toUpdate[0].description).toContain("三大陸が鼎立する。");
    expect(diff.toUpdate[0].description).toContain("アストラ-->ルミナ");
  });
});

describe("charactersMarkdown", () => {
  const sampleCharacters = [
    {
      category: "主要人物",
      description: "異世界から召喚された少年。",
      name: "主人公",
      relationships: "ヒロインの幼馴染。",
      traits: ["勇敢", "お人好し"],
    },
  ];

  it("人物をマークダウンにシリアライズできること", () => {
    const md = serializeCharactersToMarkdown(sampleCharacters);
    expect(md).toContain("# 主要人物");
    expect(md).toContain("## 主人公");
    expect(md).toContain("異世界から召喚された少年。");
    expect(md).toContain("### 特徴");
    expect(md).toContain("- 勇敢");
    expect(md).toContain("- お人好し");
    expect(md).toContain("### 関係性");
    expect(md).toContain("ヒロインの幼馴染。");
  });

  it("マークダウンから人物をパースできること", () => {
    const md =
      "# 主要人物\n\n## 主人公\n\n異世界から召喚された少年。\n\n### 特徴\n\n- 勇敢\n- お人好し\n\n### 関係性\n\nヒロインの幼馴染。";
    const parsed = parseCharactersMarkdown(md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      category: "主要人物",
      description: "異世界から召喚された少年。",
      name: "主人公",
      relationships: "ヒロインの幼馴染。",
      traits: ["勇敢", "お人好し"],
    });
  });

  it("ツリー構造と行検索ができること", () => {
    const md = "# 主要人物\n\n## 主人公\n\n異世界から召喚された少年。";
    const tree = buildCharacterTree(md);
    expect(tree).toHaveLength(1);
    expect(tree[0].category).toBe("主要人物");

    const found = findCharacterAtLine(md, 2);
    expect(found).not.toBeNull();
    expect(found?.name).toBe("主人公");
  });

  it("差分（diffCharacters）が正しく計算されること", () => {
    const existing = [
      {
        category: "主要人物",
        description: "古い説明",
        id: "1",
        name: "主人公",
        relationships: "",
        traits: ["勇敢"],
      },
    ];
    const parsed = [
      {
        category: "主要人物",
        description: "新しい説明",
        name: "主人公",
        relationships: "",
        traits: ["勇敢", "冷静"],
      },
    ];
    const diff = diffCharacters(existing, parsed);
    expect(diff.toCreate).toHaveLength(0);
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].id).toBe("1");
    expect(diff.toUpdate[0].traits).toEqual(["勇敢", "冷静"]);
    expect(diff.toDelete).toHaveLength(0);
  });

  describe("applyCharactersToMarkdown", () => {
    it("既存マークダウンに新しい人物を追加・更新できること", () => {
      const currentMd =
        "# 主人公\n\n## アレン\n\n熱血な騎士。\n\n### 特徴\n\n- 勇敢";
      const updatedMd = applyCharactersToMarkdown(currentMd, [
        {
          category: "仲間",
          name: "ルーク",
          description: "冷静な魔法使い。",
          traits: ["博識"],
        },
      ]);

      expect(updatedMd).toContain("## アレン");
      expect(updatedMd).toContain("## ルーク");
      expect(updatedMd).toContain("冷静な魔法使い。");
      expect(updatedMd).toContain("- 博識");
    });
  });

  describe("format functions", () => {
    it("formatCharactersMarkdown で人物マークダウンがソート・整形されること", () => {
      const messyMd =
        "# 仲間\n\n## ベル\n\n盗賊。\n\n# 主人公\n\n## アレン\n\n騎士。\n\n";
      const formatted = formatCharactersMarkdown(messyMd);
      expect(formatted).toContain("# 主人公\n\n## アレン");
      expect(formatted).toContain("# 仲間\n\n## ベル");
    });

    it("formatSettingsMarkdown で設定マークダウンが整形されること", () => {
      const messyMd = "# 世界観\n\n\n\n## 魔法\n\n魔力。\n\n\n";
      const formatted = formatSettingsMarkdown(messyMd);
      expect(formatted).toContain("# 世界観\n\n## 魔法\n\n魔力。");
    });

    it("formatStoryOutlineMarkdown で連続空行が圧縮され、見出し前に適切な空行が挿入されること", () => {
      const messyMd = [
        "# 構想",
        "あらすじの導入文です。",
        "- 項目1",
        "- 項目2",
        "##結末",
        "終わり。",
      ].join("\n");
      const formatted = formatStoryOutlineMarkdown(messyMd);
      // 見出しの前に空行が入り、#とタイトルの間に空白が入ること
      expect(formatted).toBe(
        "# 構想\n\nあらすじの導入文です。\n\n- 項目1\n- 項目2\n\n## 結末\n\n終わり。\n"
      );
    });

    it("ストーリー構想の複数行リスト項目と見出しが自然に整形されること", () => {
      const outlineMd = [
        "# 作品コンセプト & ログライン",
        "- **ログライン（1行要約）**:",
        "  行方不明の父を追い、魔境の根源の破壊に挑む物語。",
        "- **テーマ**:",
        "  過酷な環境を変えようとする挑戦。",
        "",
        "",
        "",
        "# 全体あらすじ",
        "### 主人公の生い立ちと旅立ち",
        "- 主人公が幼い頃、母親が病に倒れる。",
        "- **裏側**: 父は家系が遺物の正体に気づく。",
      ].join("\n");
      const formatted = formatStoryOutlineMarkdown(outlineMd);
      expect(formatted).toBe(
        [
          "# 作品コンセプト & ログライン",
          "",
          "- **ログライン（1行要約）**:",
          "  行方不明の父を追い、魔境の根源の破壊に挑む物語。",
          "- **テーマ**:",
          "  過酷な環境を変えようとする挑戦。",
          "",
          "# 全体あらすじ",
          "",
          "### 主人公の生い立ちと旅立ち",
          "",
          "- 主人公が幼い頃、母親が病に倒れる。",
          "- **裏側**: 父は家系が遺物の正体に気づく。",
          "",
        ].join("\n")
      );
    });
  });
});
