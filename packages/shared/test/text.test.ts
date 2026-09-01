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
  });
});
