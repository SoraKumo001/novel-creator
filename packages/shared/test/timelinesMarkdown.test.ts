import { describe, expect, it } from "vitest";
import {
  applyTimelinesToMarkdown,
  diffTimelines,
  parseTimelinesMarkdown,
  serializeTimelinesToMarkdown,
} from "../src/timelinesMarkdown.js";

describe("timelinesMarkdown", () => {
  const sampleItems = [
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

  it("年表リストをマークダウンに直列化できること", () => {
    const md = serializeTimelinesToMarkdown(sampleItems);
    expect(md).toContain("# 帝都暦700年");
    expect(md).toContain("## 魔王の封印");
    expect(md).toContain(
      "<!-- order: 1, timestamp: 帝都暦700年, sectionId: sec-1 -->"
    );
    expect(md).toContain("# 帝都暦720年");
    expect(md).toContain("## 勇者の誕生");
  });

  it("マークダウンから年表をパースできること", () => {
    const md = serializeTimelinesToMarkdown(sampleItems);
    const parsed = parseTimelinesMarkdown(md);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].event).toBe("魔王の封印");
    expect(parsed[0].timestamp).toBe("帝都暦700年");
    expect(parsed[0].order).toBe(1);
    expect(parsed[0].sectionId).toBe("sec-1");

    expect(parsed[1].event).toBe("勇者の誕生");
    expect(parsed[1].timestamp).toBe("帝都暦720年");
    expect(parsed[1].order).toBe(2);
  });

  it("年表差分（作成・更新・削除）を算出できること", () => {
    const existing = [
      { id: "1", event: "魔王の封印", order: 1, timestamp: "帝都暦700年" },
      { id: "2", event: "古い出来事", order: 2, timestamp: "帝都暦710年" },
    ];
    const parsed = [
      {
        category: "帝都暦700年",
        description: "",
        event: "魔王の封印",
        order: 1,
        timestamp: "帝都暦700年（修正）",
      },
      {
        category: "帝都暦720年",
        description: "",
        event: "勇者の誕生",
        order: 2,
        timestamp: "帝都暦720年",
      },
    ];

    const diff = diffTimelines(existing, parsed);
    expect(diff.toCreate).toHaveLength(1);
    expect(diff.toCreate[0].event).toBe("勇者の誕生");
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].id).toBe("1");
    expect(diff.toUpdate[0].timestamp).toBe("帝都暦700年（修正）");
    expect(diff.toDelete).toEqual(["2"]);
  });

  it("applyTimelinesToMarkdown で追加・更新・削除が正常に行えること", () => {
    const md = serializeTimelinesToMarkdown(sampleItems);
    const updatedMd = applyTimelinesToMarkdown(
      md,
      [
        {
          event: "旅立ち",
          order: 3,
          timestamp: "帝都暦738年",
        },
      ],
      ["魔王の封印"]
    );

    const parsed = parseTimelinesMarkdown(updatedMd);
    expect(parsed.find((t) => t.event === "魔王の封印")).toBeUndefined();
    expect(parsed.find((t) => t.event === "勇者の誕生")).toBeDefined();
    expect(parsed.find((t) => t.event === "旅立ち")).toBeDefined();
  });
});
