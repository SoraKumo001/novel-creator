import { describe, expect, it } from "vitest";
import {
  analyzeStoryArcPrompt,
  contentGeneration,
  creativeChatSystemPrompt,
  extractChatEntities,
  extractSettings,
  extractTimeline,
  generatePlotFromStoryOutline,
  plotGeneration,
  proofreadPrompt,
} from "../src/index.js";
import { APP_USAGE_GUIDE } from "../src/prompts/creativeChat.js";

describe("prompts schema & instructions", () => {
  it("plotGeneration: JSON 構造指示が含まれること", () => {
    const prompt = plotGeneration({
      description: "宇宙を旅する物語",
      title: "星を紡ぐ者たち",
    });
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"description"');
    expect(prompt).toContain('"chapters"');
  });

  it("contentGeneration: 読者視点指示および styleGuide が反映されること", () => {
    const prompt = contentGeneration(
      { summary: "節の概要", title: "節タイトル" },
      {
        styleGuide: "# 視点\n- 一人称: 俺",
      }
    );
    expect(prompt).toContain("セットアップの徹底");
    expect(prompt).toContain("# 執筆スタイル・文体ガイドライン");
    expect(prompt).toContain("- 一人称: 俺");
  });

  it("extractTimeline: JSON 出力指示が含まれること", () => {
    const prompt = extractTimeline("本文テキスト");
    expect(prompt).toContain('"event"');
    expect(prompt).toContain('"order"');
  });

  it("extractSettings: JSON 出力指示が含まれること", () => {
    const prompt = extractSettings("本文テキスト");
    expect(prompt).toContain('"category"');
    expect(prompt).toContain('"name"');
  });

  it("extractChatEntities: 主要エンティティの抽出キーが含まれること", () => {
    const prompt = extractChatEntities("相談内容");
    expect(prompt).toContain('"characters"');
    expect(prompt).toContain('"settings"');
    expect(prompt).toContain('"foreshadowings"');
    expect(prompt).toContain('"timelines"');
    expect(prompt).toContain('"plots"');
  });

  it("proofreadPrompt: 校正結果の JSON キーが含まれること", () => {
    const prompt = proofreadPrompt({
      body: "本文テキスト",
      novelTitle: "タイトル",
    });
    expect(prompt).toContain('"score"');
    expect(prompt).toContain('"issues"');
    expect(prompt).toContain('"polishedBody"');
  });

  it("generatePlotFromStoryOutline: JSON 形式指示が含まれること", () => {
    const prompt = generatePlotFromStoryOutline({
      novelTitle: "テスト小説",
      storyOutline: "# あらすじ\n冒険の物語",
    });
    expect(prompt).toContain('"chapters"');
  });

  it("analyzeStoryArcPrompt: tension 構造キーが含まれること", () => {
    const prompt = analyzeStoryArcPrompt({
      chapters: [
        {
          id: "c1",
          sections: [{ id: "s1", summary: "旅立ち", title: "節1" }],
          title: "第1章",
        },
      ],
      novelTitle: "テスト小説",
    });
    expect(prompt).toContain("tension");
  });

  it("creativeChatSystemPrompt: アプリ使い方ガイドラインとツール定義が含まれること", () => {
    const prompt = creativeChatSystemPrompt();
    expect(prompt).toContain("アプリ機能カタログ");
    expect(prompt).toContain("getStoryOutline");
    expect(prompt).toContain("proposeUpdateStoryOutline");
    expect(APP_USAGE_GUIDE.length).toBeLessThan(700);
  });
});
