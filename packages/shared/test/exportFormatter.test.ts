import { describe, expect, it } from "vitest";
import {
  formatNovelText,
  type NovelExportData,
} from "../src/exportFormatter.js";

const mockNovel: NovelExportData = {
  chapters: [
    {
      order: 1,
      sections: [
        {
          content: "まばゆい光とともに、私は見知らぬ祭壇に立っていた。",
          order: 1,
          title: "召喚の儀式",
        },
        {
          content: "「どうか、魔王を倒してください」王女は頭を下げた。",
          order: 2,
          title: "王女の依頼",
        },
      ],
      title: "始まりの町",
    },
    {
      order: 2,
      sections: [
        {
          content: "朝焼けの中、私は城門をくぐった。",
          order: 1,
          title: "門出",
        },
      ],
      title: "旅立ちの朝",
    },
  ],
  description: "勇者として召喚された主人公の物語。",
  title: "異世界転生記",
};

describe("exportFormatter", () => {
  it("Markdown 形式で正しく出力されること", () => {
    const output = formatNovelText(mockNovel, "markdown");
    expect(output).toContain("# 異世界転生記");
    expect(output).toContain("勇者として召喚された主人公の物語。");
    expect(output).toContain("## 始まりの町");
    expect(output).toContain("### 召喚の儀式");
    expect(output).toContain(
      "まばゆい光とともに、私は見知らぬ祭壇に立っていた。"
    );
    expect(output).toContain("## 旅立ちの朝");
  });

  it("Plain text 形式で正しく出力されること", () => {
    const output = formatNovelText(mockNovel, "plain");
    expect(output).toContain("■ 異世界転生記");
    expect(output).toContain("【始まりの町】");
    expect(output).toContain("[召喚の儀式]");
    expect(output).toContain(
      "まばゆい光とともに、私は見知らぬ祭壇に立っていた。"
    );
  });

  it("なろう形式で正しく出力されること", () => {
    const output = formatNovelText(mockNovel, "narou");
    expect(output).toContain("異世界転生記");
    expect(output).toContain("第1章");
    expect(output).toContain("始まりの町");
    expect(output).toContain("召喚の儀式");
  });

  it("カクヨム形式で正しく出力されること", () => {
    const output = formatNovelText(mockNovel, "kakuyomu");
    expect(output).toContain("異世界転生記");
    expect(output).toContain("【始まりの町】");
    expect(output).toContain("召喚の儀式");
  });
});
