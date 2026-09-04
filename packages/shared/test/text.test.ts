import { describe, expect, it } from "vitest";
import { countWords } from "../src/text.js";

describe("text utility", () => {
  describe("countWords", () => {
    it("空文字列の場合は 0 を返すこと", () => {
      expect(countWords("")).toBe(0);
      expect(countWords("   ")).toBe(0);
    });

    it("日本語の文字数を正しくカウントすること", () => {
      expect(countWords("こんにちは世界")).toBe(7);
      expect(countWords("あいうえお 123")).toBe(5);
    });

    it("英単語数を正しくカウントすること", () => {
      expect(countWords("Hello world")).toBe(2);
      expect(countWords("The quick brown fox jumps over the lazy dog")).toBe(9);
    });

    it("ルビ記法の読み（rt部分）を除外して数えること", () => {
      expect(countWords("|漢字《かんじ》")).toBe(2);
      expect(countWords("漢字《かんじ》")).toBe(2);
      expect(countWords("《《秘密》》")).toBe(2);
    });

    it("日本語が1文字でもあると英語を無視すること（挙動固定）", () => {
      expect(countWords("あ Hello")).toBe(1);
      expect(countWords("Hello あ")).toBe(1);
    });
  });
});
