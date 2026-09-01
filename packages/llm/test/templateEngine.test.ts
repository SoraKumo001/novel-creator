import { describe, expect, it } from "vitest";
import {
  AVAILABLE_PROMPT_VARIABLES,
  renderPromptTemplate,
} from "../src/templateEngine.js";

describe("templateEngine", () => {
  it("テンプレート内のプレースホルダー変数を置換すること", () => {
    const template = `タイトル: {novelTitle}
選択テキスト: "{selectedText}"
文脈: {surroundingText}
指示: {instruction}`;

    const rendered = renderPromptTemplate(template, {
      instruction: "もっと緊迫感を出す",
      novelTitle: "魔術士の夜",
      selectedText: "彼は静かに杖を構えた。",
      surroundingText: "暗闇の中で風が吹いた。",
    });

    expect(rendered).toContain("タイトル: 魔術士の夜");
    expect(rendered).toContain('選択テキスト: "彼は静かに杖を構えた。"');
    expect(rendered).toContain("文脈: 暗闇の中で風が吹いた。");
    expect(rendered).toContain("指示: もっと緊迫感を出す");
  });

  it("instruction と customInstruction のエイリアスが相互に機能すること", () => {
    const template = "指示: {instruction} / カスタム: {customInstruction}";
    const res1 = renderPromptTemplate(template, {
      customInstruction: "ハードボイルドに",
    });
    expect(res1).toBe("指示: ハードボイルドに / カスタム: ハードボイルドに");

    const res2 = renderPromptTemplate(template, {
      instruction: "ファンタジー風に",
    });
    expect(res2).toBe("指示: ファンタジー風に / カスタム: ファンタジー風に");
  });

  it("未定義の変数は空文字に置換されること", () => {
    const template = "前[{undefinedVar}]後";
    const rendered = renderPromptTemplate(template, {});
    expect(rendered).toBe("前[]後");
  });

  it("AVAILABLE_PROMPT_VARIABLES が定義されていること", () => {
    expect(AVAILABLE_PROMPT_VARIABLES.length).toBeGreaterThan(0);
    const tags = AVAILABLE_PROMPT_VARIABLES.map((v) => v.key);
    expect(tags).toContain("{selectedText}");
    expect(tags).toContain("{instruction}");
  });
});
