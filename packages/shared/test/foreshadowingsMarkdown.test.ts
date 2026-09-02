import { describe, expect, it } from "vitest";
import {
  applyForeshadowingsToMarkdown,
  parseForeshadowingsMarkdown,
  serializeForeshadowingsToMarkdown,
} from "../src/foreshadowingsMarkdown.js";

describe("foreshadowingsMarkdown", () => {
  const sampleItems = [
    {
      category: "主要伏線",
      title: "ペンダントの秘密",
      description: "古代魔法の紋章が刻まれている。",
      status: "unresolved" as const,
    },
    {
      category: "主要伏線",
      title: "王都の黒幕",
      description: "宰相の怪しい動き。",
      status: "resolved" as const,
    },
  ];

  it("伏線リストをマークダウンに直列化できること", () => {
    const md = serializeForeshadowingsToMarkdown(sampleItems);
    expect(md).toContain("# 主要伏線");
    expect(md).toContain("## ペンダントの秘密");
    expect(md).toContain("<!-- status: unresolved -->");
    expect(md).toContain("古代魔法の紋章が刻まれている。");
    expect(md).toContain("## 王都の黒幕");
    expect(md).toContain("<!-- status: resolved -->");
  });

  it("マークダウンから伏線をパースできること", () => {
    const md = serializeForeshadowingsToMarkdown(sampleItems);
    const parsed = parseForeshadowingsMarkdown(md);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("ペンダントの秘密");
    expect(parsed[0].status).toBe("unresolved");
    expect(parsed[0].description).toBe("古代魔法の紋章が刻まれている。");

    expect(parsed[1].title).toBe("王都の黒幕");
    expect(parsed[1].status).toBe("resolved");
  });

  it("applyForeshadowingsToMarkdown で追加・更新・削除ができること", () => {
    const md = serializeForeshadowingsToMarkdown(sampleItems);
    const updatedMd = applyForeshadowingsToMarkdown(
      md,
      [
        {
          category: "サブ伏線",
          title: "謎の手紙",
          description: "差出人不明。",
          status: "unresolved",
        },
      ],
      ["王都の黒幕"]
    );

    const parsed = parseForeshadowingsMarkdown(updatedMd);
    expect(parsed.find((f) => f.title === "王都の黒幕")).toBeUndefined();
    expect(parsed.find((f) => f.title === "ペンダントの秘密")).toBeDefined();
    expect(parsed.find((f) => f.title === "謎の手紙")).toBeDefined();
  });
});
