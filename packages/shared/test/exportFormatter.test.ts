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

  it("デフォルトではルビ記法を保持すること", () => {
    const novel: NovelExportData = {
      ...mockNovel,
      chapters: [
        {
          order: 1,
          sections: [
            {
              content: "｜漢字《かんじ》のテスト。",
              order: 1,
              title: null,
            },
          ],
          title: "章",
        },
      ],
    };
    const output = formatNovelText(novel, "plain");
    expect(output).toContain("｜漢字《かんじ》");
  });

  it("strip指定でルビ記法を除去すること", () => {
    const novel: NovelExportData = {
      ...mockNovel,
      chapters: [
        {
          order: 1,
          sections: [
            {
              content: "｜漢字《かんじ》のテスト。",
              order: 1,
              title: null,
            },
          ],
          title: "章",
        },
      ],
    };
    const output = formatNovelText(novel, "plain", { ruby: "strip" });
    expect(output).toContain("漢字のテスト。");
    expect(output).not.toContain("《かんじ》");
  });

  it("html指定でルビを<ruby>に変換すること", () => {
    const novel: NovelExportData = {
      ...mockNovel,
      chapters: [
        {
          order: 1,
          sections: [
            {
              content: "｜漢字《かんじ》のテスト。",
              order: 1,
              title: null,
            },
          ],
          title: "章",
        },
      ],
    };
    const output = formatNovelText(novel, "markdown", { ruby: "html" });
    expect(output).toContain("<ruby>漢字<rt>かんじ</rt></ruby>");
  });

  it("なろう形式で3連空行を2連に正規化し前後をtrimすること", () => {
    const novel: NovelExportData = {
      ...mockNovel,
      chapters: [
        {
          order: 1,
          sections: [
            {
              content: "一行目\n\n\n\n二行目",
              order: 1,
              title: null,
            },
          ],
          title: "章",
        },
      ],
    };
    const output = formatNovelText(novel, "narou");
    expect(output).not.toMatch(/\n{3,}/);
    expect(output).toContain("一行目\n\n二行目");
    expect(output).not.toMatch(/^\n|\n$/);
  });

  it("カクヨム形式で3連空行を2連に正規化すること", () => {
    const novel: NovelExportData = {
      ...mockNovel,
      chapters: [
        {
          order: 1,
          sections: [
            {
              content: "  前後空白あり\n\n\n本文  ",
              order: 1,
              title: null,
            },
          ],
          title: "章",
        },
      ],
    };
    const output = formatNovelText(novel, "kakuyomu");
    expect(output).not.toMatch(/\n{3,}/);
    expect(output).toContain("前後空白あり\n\n本文");
  });
});
