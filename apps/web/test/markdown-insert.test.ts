import { describe, expect, it } from "vitest";
import { applyMarkdownInsert } from "../src/hooks/useMarkdownEntityEditor.js";

describe("applyMarkdownInsert", () => {
  it("選択範囲を太字・斜体・取消線で wrap すること", () => {
    expect(applyMarkdownInsert("本文です", 0, 2, "bold")).toEqual({
      text: "**本文**です",
      selectionStart: 2,
      selectionEnd: 4,
    });
    expect(applyMarkdownInsert("本文です", 0, 2, "italic")).toEqual({
      text: "*本文*です",
      selectionStart: 1,
      selectionEnd: 3,
    });
    expect(applyMarkdownInsert("本文です", 0, 2, "strike")).toEqual({
      text: "~~本文~~です",
      selectionStart: 2,
      selectionEnd: 4,
    });
  });

  it("未選択時はスニペット挿入しプレースホルダを選択すること", () => {
    expect(applyMarkdownInsert("あ", 1, 1, "bold")).toEqual({
      text: "あ**太字**",
      selectionStart: 3,
      selectionEnd: 5,
    });
    expect(applyMarkdownInsert("", 0, 0, "bouten")).toEqual({
      text: "《《強調》》",
      selectionStart: 2,
      selectionEnd: 4,
    });
  });

  it("ルビは |漢字《よみ》形式にすること", () => {
    // 選択あり: 読み部分を選択状態にする
    expect(applyMarkdownInsert("漢字です", 0, 2, "ruby")).toEqual({
      text: "|漢字《よみ》です",
      selectionStart: 4,
      selectionEnd: 6,
    });
    // 未選択: 本文プレースホルダを選択状態にする
    expect(applyMarkdownInsert("", 0, 0, "ruby")).toEqual({
      text: "|テキスト《よみ》",
      selectionStart: 1,
      selectionEnd: 5,
    });
  });

  it("リンクは URL を選択状態にすること", () => {
    expect(applyMarkdownInsert("本文", 0, 2, "link")).toEqual({
      text: "[本文](https://example.com)",
      selectionStart: 5,
      selectionEnd: 24,
    });
    expect(applyMarkdownInsert("", 0, 0, "link")).toEqual({
      text: "[リンクテキスト](https://example.com)",
      selectionStart: 1,
      selectionEnd: 8,
    });
  });

  it("引用・見出しは行頭付与し、空行にはプレースホルダを入れること", () => {
    expect(applyMarkdownInsert("一行目", 0, 0, "quote")).toEqual({
      text: "> 一行目",
      selectionStart: 2,
      selectionEnd: 2,
    });
    expect(applyMarkdownInsert("", 0, 0, "heading")).toEqual({
      text: "## 見出し",
      selectionStart: 3,
      selectionEnd: 6,
    });
    // 複数行選択は各行へ付与する
    expect(applyMarkdownInsert("a\nb", 0, 3, "quote")).toEqual({
      text: "> a\n> b",
      selectionStart: 0,
      selectionEnd: 7,
    });
    // 既に見出し・引用の行は変えない
    expect(applyMarkdownInsert("## 既存", 0, 4, "heading")).toEqual({
      text: "## 既存",
      selectionStart: 0,
      selectionEnd: 5,
    });
  });

  it("範囲外オフセットを丸めること", () => {
    expect(applyMarkdownInsert("ab", -5, 99, "bold")).toEqual({
      text: "**ab**",
      selectionStart: 2,
      selectionEnd: 4,
    });
  });
});
