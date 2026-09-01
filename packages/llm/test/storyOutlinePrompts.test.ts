import { describe, expect, it } from "vitest";
import {
  editStoryOutlineDocument,
  editStoryOutlineSection,
  generatePlotFromStoryOutline,
} from "../src/prompts/storyOutlinePrompts.js";

describe("storyOutlinePrompts", () => {
  it("editStoryOutlineSection プロンプトに対象セクションと指示が含まれること", () => {
    const prompt = editStoryOutlineSection(
      {
        category: "ストーリー構成",
        content: "主人公が勝利してハッピーエンド。",
        name: "結（結末）",
      },
      "ビターエンドに変更して",
      { novelTitle: "テスト小説" }
    );
    expect(prompt).toContain("結（結末）");
    expect(prompt).toContain("主人公が勝利してハッピーエンド");
    expect(prompt).toContain("ビターエンドに変更して");
    expect(prompt).toContain("テスト小説");
  });

  it("editStoryOutlineDocument プロンプトに文書全体と指示が含まれること", () => {
    const prompt = editStoryOutlineDocument(
      "# あらすじ\n本文",
      "全体を三幕構成に整えて",
      {
        novelTitle: "テスト小説",
      }
    );
    expect(prompt).toContain("# あらすじ");
    expect(prompt).toContain("全体を三幕構成に整えて");
  });

  it("generatePlotFromStoryOutline プロンプトにストーリー構想が含まれJSON形式指示があること", () => {
    const prompt = generatePlotFromStoryOutline({
      novelTitle: "テスト小説",
      storyOutline: "# あらすじ\n冒険の物語",
    });
    expect(prompt).toContain("テスト小説");
    expect(prompt).toContain("# あらすじ");
    expect(prompt).toContain('"chapters"');
  });
});
