/**
 * 日本語文字数および英語単語数を考慮したテキストのカウントを行う。
 * 日本語が含まれる場合は日本語文字数をカウントし、それ以外は空白区切りの単語数を返す。
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  const japanese = trimmed.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g);
  if (japanese && japanese.length > 0) {
    return japanese.length;
  }
  return trimmed.split(/\s+/).length;
}
