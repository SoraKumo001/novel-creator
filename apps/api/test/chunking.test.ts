import { describe, expect, it } from "vitest";
import { chunkText } from "../src/core/chunking.js";

describe("chunkText", () => {
  it("空文字の場合は空配列を返すこと", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("最大文字数以下のテキストは分割せずそのまま1つのチャンクとして返すこと", () => {
    const text = "これは短いテキストです。分割されません。";
    const chunks = chunkText(text, { maxChunkSize: 100 });
    expect(chunks).toEqual([text]);
  });

  it("句点などの文境界で適切に分割されること", () => {
    const s1 =
      "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。";
    const s2 =
      "何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。";
    const text = s1 + s2;

    const chunks = chunkText(text, { maxChunkSize: 45, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 45)).toBe(true);
  });

  it("オーバーラップが適用されること", () => {
    const s1 = "第1段落の文章です。ここに文が続きます。";
    const s2 = "第2段落の文章です。さらに文が続きます。";
    const text = s1 + s2;

    const chunks = chunkText(text, { maxChunkSize: 30, overlap: 10 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("鉤括弧で終わるセリフも正しく分割されること", () => {
    const text = "「こんにちは！」彼女は言った。「さようなら！」";
    const chunks = chunkText(text, { maxChunkSize: 20, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});
