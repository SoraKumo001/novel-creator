import { describe, expect, it } from "vitest";
import {
  contentGeneration,
  generateStyleGuideDraftPrompt,
  inlineAssistPrompt,
  proofreadPrompt,
} from "../src/index.js";

describe("StyleGuide in LLM Prompts", () => {
  it("contentGeneration に styleGuide が正しく埋め込まれること", () => {
    const prompt = contentGeneration(
      { summary: "主人公が仲間と出会う", title: "第1節 出会い" },
      {
        styleGuide: "# 視点\n- 一人称: 俺\n# 文体\n- 軽快なラノベ調",
      }
    );

    expect(prompt).toContain("# 執筆スタイル・文体ガイドライン");
    expect(prompt).toContain("- 一人称: 俺");
    expect(prompt).toContain("- 軽快なラノベ調");
    expect(prompt).toContain("上記の「執筆スタイル・文体ガイドライン」");
  });

  it("proofreadPrompt に styleGuide が正しく組み込まれること", () => {
    const prompt = proofreadPrompt({
      body: "彼は剣を抜いた。",
      novelTitle: "勇者の旅立ち",
      styleGuide: "視点は三人称一元視点。スラング禁止。",
    });

    expect(prompt).toContain("■ 作品の執筆スタイル・文体ガイドライン:");
    expect(prompt).toContain("視点は三人称一元視点。スラング禁止。");
  });

  it("inlineAssistPrompt に styleGuide が正しく組み込まれること", () => {
    const prompt = inlineAssistPrompt({
      action: "expand",
      novelTitle: "異世界転生記",
      selectedText: "私は歩いた。",
      styleGuide: "一人称は「私」。です・ます調。",
    });

    expect(prompt).toContain("■ 作品の執筆スタイル・文体ガイドライン:");
    expect(prompt).toContain("一人称は「私」。です・ます調。");
  });

  it("generateStyleGuideDraftPrompt が適切なプロンプトを構築すること", () => {
    const prompt = generateStyleGuideDraftPrompt({
      characters: ["アルト（主人公・15歳）", "セリア（師匠・大魔導士）"],
      description: "見習い魔術士の成長譚",
      novelTitle: "魔術士の弟子",
      settings: ["魔術学院", "禁忌魔法"],
    });

    expect(prompt).toContain("作品タイトル: 魔術士の弟子");
    expect(prompt).toContain("見習い魔術士の成長譚");
    expect(prompt).toContain("アルト（主人公・15歳）");
    expect(prompt).toContain("魔術学院");
    expect(prompt).toContain("Markdown形式のみを出力");
  });
});
