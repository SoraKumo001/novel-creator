import { describe, expect, it } from "vitest";
import {
  applyPlotToMarkdown,
  diffPlot,
  formatPlotMarkdown,
  parsePlotMarkdown,
  serializePlotToMarkdown,
} from "../src/plotMarkdown.js";

describe("plotMarkdown", () => {
  const sampleChapters = [
    {
      order: 1,
      title: "第1章 出会い",
      summary: "主人公とヒロインが出会う章。",
      sections: [
        {
          order: 1,
          title: "第1節 旅立ちの朝",
          summary: "村を出発する。",
        },
        {
          order: 2,
          title: "第2節 森の遭遇",
          summary: "魔物に襲われるヒロインを救出する。",
        },
      ],
    },
    {
      order: 2,
      title: "第2章 帝都へ",
      summary: "帝都へ向かう旅路。",
      sections: [],
    },
  ];

  it("プロットをマークダウンに直列化できること", () => {
    const md = serializePlotToMarkdown(sampleChapters);
    expect(md).toContain("# 第1章 出会い");
    expect(md).toContain("主人公とヒロインが出会う章。");
    expect(md).toContain("## 第1節 旅立ちの朝");
    expect(md).toContain("村を出発する。");
    expect(md).toContain("## 第2節 森の遭遇");
    expect(md).toContain("# 第2章 帝都へ");
  });

  it("マークダウンからプロットをパースできること", () => {
    const md = serializePlotToMarkdown(sampleChapters);
    const parsed = parsePlotMarkdown(md);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("第1章 出会い");
    expect(parsed[0].summary).toBe("主人公とヒロインが出会う章。");
    expect(parsed[0].sections).toHaveLength(2);
    expect(parsed[0].sections[0].title).toBe("第1節 旅立ちの朝");
    expect(parsed[0].sections[0].summary).toBe("村を出発する。");

    expect(parsed[1].title).toBe("第2章 帝都へ");
    expect(parsed[1].summary).toBe("帝都へ向かう旅路。");
    expect(parsed[1].sections).toHaveLength(0);
  });

  it("プロット差分（章・節の作成・更新・削除）を算出できること", () => {
    const existing = [
      {
        id: "ch-1",
        title: "第1章 出会い",
        order: 1,
        summary: "古い概要",
        sections: [
          {
            id: "sec-1",
            title: "第1節 旅立ちの朝",
            order: 1,
            summary: "古い節概要",
          },
          { id: "sec-2", title: "第2節 削除予定節", order: 2, summary: "" },
        ],
      },
      {
        id: "ch-2",
        title: "削除予定章",
        order: 2,
        summary: "",
        sections: [],
      },
    ];

    const parsed = [
      {
        title: "第1章 出会い",
        order: 1,
        summary: "新しい概要",
        sections: [
          { title: "第1節 旅立ちの朝", order: 1, summary: "新しい節概要" },
          { title: "第2節 新規節", order: 2, summary: "新節の概要" },
        ],
      },
      {
        title: "第3章 決戦",
        order: 2,
        summary: "クライマックス",
        sections: [],
      },
    ];

    const diff = diffPlot(existing, parsed);

    expect(diff.chaptersToCreate).toHaveLength(1);
    expect(diff.chaptersToCreate[0].title).toBe("第3章 決戦");
    expect(diff.chaptersToUpdate).toHaveLength(1);
    expect(diff.chaptersToUpdate[0].id).toBe("ch-1");
    expect(diff.chaptersToUpdate[0].summary).toBe("新しい概要");
    expect(diff.chaptersToDelete).toEqual(["ch-2"]);

    expect(diff.sectionsToCreate).toHaveLength(1);
    expect(diff.sectionsToCreate[0].title).toBe("第2節 新規節");
    expect(diff.sectionsToUpdate).toHaveLength(1);
    expect(diff.sectionsToUpdate[0].id).toBe("sec-1");
    expect(diff.sectionsToDelete).toEqual(["sec-2"]);
  });

  it("applyPlotToMarkdown で章の追加・更新・削除ができること", () => {
    const md = serializePlotToMarkdown(sampleChapters);
    const updatedMd = applyPlotToMarkdown(
      md,
      [
        {
          title: "第3章 決戦",
          summary: "魔王城突入。",
          order: 3,
        },
      ],
      ["第2章 帝都へ"]
    );

    const parsed = parsePlotMarkdown(updatedMd);
    expect(parsed.find((c) => c.title === "第2章 帝都へ")).toBeUndefined();
    expect(parsed.find((c) => c.title === "第1章 出会い")).toBeDefined();
    expect(parsed.find((c) => c.title === "第3章 決戦")).toBeDefined();
  });

  it("serialize→parse の round-trip で chapterId/sectionId が保持されること", () => {
    const withIds = [
      {
        id: "ch-1",
        order: 1,
        title: "第1章 出会い",
        summary: "概要メモ",
        sections: [
          { id: "sec-1", order: 1, title: "第1節", summary: "節メモ" },
        ],
      },
    ];
    const md = serializePlotToMarkdown(withIds);
    expect(md).toContain("<!-- chapterId: ch-1 -->");
    expect(md).toContain("<!-- sectionId: sec-1 -->");
    const parsed = parsePlotMarkdown(md);
    expect(parsed[0].id).toBe("ch-1");
    expect(parsed[0].sections[0].id).toBe("sec-1");
    expect(parsed[0].summary).toBe("概要メモ");
    expect(parsed[0].sections[0].summary).toBe("節メモ");
  });

  it("ID なしのレガシー markdown でもパース・差分できること", () => {
    const md = "# 第1章\n\n概要\n\n## 第1節\n\n節概要\n";
    const parsed = parsePlotMarkdown(md);
    expect(parsed[0].id).toBeUndefined();
    expect(parsed[0].sections[0].id).toBeUndefined();
    const diff = diffPlot(
      [
        {
          id: "ch-1",
          title: "第1章",
          order: 1,
          summary: "概要",
          sections: [
            { id: "sec-1", title: "第1節", order: 1, summary: "節概要" },
          ],
        },
      ],
      parsed
    );
    expect(diff.chaptersToCreate).toHaveLength(0);
    expect(diff.chaptersToDelete).toHaveLength(0);
    expect(diff.chaptersToUpdate).toHaveLength(0);
    expect(diff.sectionsToCreate).toHaveLength(0);
    expect(diff.sectionsToDelete).toHaveLength(0);
  });

  it("改名しても ID マッチで更新になり本文が消えないこと", () => {
    const existing = [
      {
        id: "ch-1",
        title: "旧タイトル",
        order: 1,
        summary: "章メモ",
        sections: [{ id: "sec-1", title: "旧節", order: 1, summary: "節メモ" }],
      },
    ];
    const parsed = [
      {
        id: "ch-1",
        title: "新タイトル",
        order: 1,
        summary: "章メモ",
        sections: [{ id: "sec-1", title: "新節", order: 1, summary: "節メモ" }],
      },
    ];
    const diff = diffPlot(existing, parsed);
    expect(diff.chaptersToCreate).toHaveLength(0);
    expect(diff.chaptersToDelete).toHaveLength(0);
    expect(diff.chaptersToUpdate).toHaveLength(1);
    expect(diff.chaptersToUpdate[0]).toMatchObject({
      id: "ch-1",
      title: "新タイトル",
      summary: "章メモ",
    });
    expect(diff.sectionsToCreate).toHaveLength(0);
    expect(diff.sectionsToDelete).toHaveLength(0);
    expect(diff.sectionsToUpdate).toHaveLength(1);
    expect(diff.sectionsToUpdate[0]).toMatchObject({
      id: "sec-1",
      title: "新節",
      summary: "節メモ",
    });
  });

  it("節の章またぎ移動でも ID マッチで更新になること", () => {
    const existing = [
      {
        id: "ch-1",
        title: "第1章",
        order: 1,
        summary: "",
        sections: [{ id: "sec-1", title: "移動節", order: 1, summary: "本文" }],
      },
      { id: "ch-2", title: "第2章", order: 2, summary: "", sections: [] },
    ];
    const parsed = [
      { title: "第1章", order: 1, summary: "", sections: [] },
      {
        id: "ch-2",
        title: "第2章",
        order: 2,
        summary: "",
        sections: [{ id: "sec-1", title: "移動節", order: 1, summary: "本文" }],
      },
    ];
    // 第1章はレガシー fallback で一致させる
    const diff = diffPlot(existing, parsed);
    expect(diff.sectionsToDelete).toHaveLength(0);
    expect(diff.sectionsToCreate).toHaveLength(0);
    expect(diff.sectionsToUpdate).toHaveLength(1);
    expect(diff.sectionsToUpdate[0]).toMatchObject({
      id: "sec-1",
      chapterId: "ch-2",
    });
  });

  it("format 後も ID が保持されること", () => {
    const md = serializePlotToMarkdown([
      {
        id: "ch-1",
        order: 1,
        title: "第1章",
        summary: "概要",
        sections: [{ id: "sec-1", order: 1, title: "第1節", summary: "メモ" }],
      },
    ]);
    const formatted = formatPlotMarkdown(md);
    const reparsed = parsePlotMarkdown(formatted);
    expect(reparsed[0].id).toBe("ch-1");
    expect(reparsed[0].sections[0].id).toBe("sec-1");
  });
});
