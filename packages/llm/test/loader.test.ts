import { describe, expect, it } from "vitest";
import { getPromptTemplate, listPromptNames } from "../src/prompts/loader.js";
import { renderPromptTemplate } from "../src/templateEngine.js";

describe("Prompt Loader", () => {
  it("すべてのプロンプト名一覧を取得できること", () => {
    const names = listPromptNames();
    expect(names.length).toBeGreaterThanOrEqual(30);
    expect(names).toContain("contentGeneration");
    expect(names).toContain("plotGeneration");
    expect(names).toContain("proofread");
    expect(names).toContain("creativeChat");
  });

  it("getPromptTemplate: 存在するテンプレートのメタデータと本文を取得できること", () => {
    const tpl = getPromptTemplate("plotGeneration");
    expect(tpl.metadata.name).toBe("plotGeneration");
    expect(tpl.metadata.category).toBe("generation");
    expect(tpl.body).toContain("あなたはプロの小説家です");
    expect(tpl.body).toContain("{title}");
  });

  it("getPromptTemplate: 存在しないテンプレート名はエラーになること", () => {
    expect(() => getPromptTemplate("nonExistentPrompt")).toThrow(
      'Prompt template not found: "nonExistentPrompt"'
    );
  });

  it("テンプレートを renderPromptTemplate で正常に展開できること", () => {
    const tpl = getPromptTemplate("chapterSummary");
    const rendered = renderPromptTemplate(tpl.body, {
      chapterOrder: 1,
      chapterTitle: "旅立ちの朝",
      description: "青年の冒険譚",
      existingSummary: "村を出発する",
      title: "テスト小説",
    });

    expect(rendered).toContain("タイトル: テスト小説");
    expect(rendered).toContain("章タイトル: 旅立ちの朝");
    expect(rendered).toContain('"order": 1');
  });
});
