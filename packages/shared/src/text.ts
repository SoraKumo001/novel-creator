import { stripRuby } from "./ruby.js";

/**
 * 日本語文字数および英語単語数を考慮したテキストのカウントを行う（正本）。
 * - ルビ記法（|漢字《よみ》・漢字《よみ》・《《傍点》》）は stripRuby で本文のみにしてから数える（rt部分除外）。
 * - 挙動固定: 日本語が1文字でも含まれる場合は日本語文字数を返し、英語単語数は無視する。
 */
export function countWords(text: string): number {
  const trimmed = stripRuby(text).trim();
  if (!trimmed) {
    return 0;
  }
  const japanese = trimmed.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g);
  if (japanese && japanese.length > 0) {
    return japanese.length;
  }
  return trimmed.split(/\s+/).length;
}
