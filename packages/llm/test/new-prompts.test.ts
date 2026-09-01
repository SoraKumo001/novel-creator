import { describe, expect, it } from "vitest";
import {
  analyzeSettingImpactPrompt,
  analyzeStoryArcPrompt,
  checkCharacterVoicePrompt,
  inlineAssistPrompt,
  multiPersonaReviewPrompt,
} from "../src/index.js";

describe("New Analysis and Writing LLM Prompts", () => {
  it("inlineAssistPrompt が正しくプロンプトを構築すること", () => {
    const prompt = inlineAssistPrompt({
      action: "expand",
      novelTitle: "星海の旅人",
      selectedText: "彼は走った。",
    });
    expect(prompt).toContain("星海の旅人");
    expect(prompt).toContain("彼は走った。");
    expect(prompt).toContain("五感");
  });

  it("checkCharacterVoicePrompt が正しくプロンプトを構築すること", () => {
    const prompt = checkCharacterVoicePrompt({
      body: "アリス「俺は行くぜ！」",
      characters: [
        {
          category: "主人公",
          firstPerson: "私",
          name: "アリス",
          secondPerson: "あなた",
          speechPattern: "丁寧語、〜ですわ",
        },
      ],
      novelTitle: "星海の旅人",
    });
    expect(prompt).toContain("アリス");
    expect(prompt).toContain("一人称: 私");
    expect(prompt).toContain("アリス「俺は行くぜ！」");
  });

  it("analyzeSettingImpactPrompt が正しくプロンプトを構築すること", () => {
    const prompt = analyzeSettingImpactPrompt({
      afterValue: "年齢: 25歳",
      beforeValue: "年齢: 15歳",
      changeTarget: "character",
      novelTitle: "星海の旅人",
      targetName: "アリス",
    });
    expect(prompt).toContain("アリス");
    expect(prompt).toContain("年齢: 15歳");
    expect(prompt).toContain("年齢: 25歳");
  });

  it("analyzeStoryArcPrompt が正しくプロンプトを構築すること", () => {
    const prompt = analyzeStoryArcPrompt({
      chapters: [
        {
          id: "c1",
          sections: [{ id: "s1", summary: "旅立ち", title: "節1" }],
          title: "第1章",
        },
      ],
      novelTitle: "星海の旅人",
    });
    expect(prompt).toContain("第1章");
    expect(prompt).toContain("旅立ち");
    expect(prompt).toContain("tension");
  });

  it("multiPersonaReviewPrompt が正しくプロンプトを構築すること", () => {
    const prompt = multiPersonaReviewPrompt({
      chapterTitle: "第1章",
      novelTitle: "星海の旅人",
      text: "宇宙船が起動した。",
    });
    expect(prompt).toContain("星海の旅人");
    expect(prompt).toContain("宇宙船が起動した。");
    expect(prompt).toContain("editor");
    expect(prompt).toContain("casual");
  });
});
