export interface ChunkOptions {
  /** 1チャンクあたりの最大文字数（デフォルト: 800） */
  maxChunkSize?: number;
  /** チャンク間のオーバーラップ文字数（デフォルト: 100） */
  overlap?: number;
}

/**
 * 日本語テキストを文・段落境界を意識して適切なサイズにチャンク分割する。
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChunkSize = options.maxChunkSize ?? 800;
  const overlap = options.overlap ?? 100;

  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.length <= maxChunkSize) {
    return [trimmed];
  }

  // 文境界（句点、感嘆符、疑問符、改行）で分割して文リストを作成
  const sentences: string[] = [];
  let currentSentence = "";

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    currentSentence += char;

    const isDelimiter =
      char === "。" ||
      char === "！" ||
      char === "!" ||
      char === "？" ||
      char === "?" ||
      char === "\n";

    if (isDelimiter) {
      // 閉じ鉤括弧などが直後に続く場合はそれも含める
      while (
        i + 1 < trimmed.length &&
        (trimmed[i + 1] === "」" ||
          trimmed[i + 1] === "』" ||
          trimmed[i + 1] === "）" ||
          trimmed[i + 1] === ")")
      ) {
        i++;
        currentSentence += trimmed[i];
      }
      sentences.push(currentSentence);
      currentSentence = "";
    }
  }

  if (currentSentence.length > 0) {
    sentences.push(currentSentence);
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    // もし単一の文が maxChunkSize を超える場合は強制分割
    if (sentence.length > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      for (let i = 0; i < sentence.length; i += maxChunkSize - overlap) {
        const slice = sentence.slice(i, i + maxChunkSize);
        if (slice.trim()) {
          chunks.push(slice.trim());
        }
      }
      continue;
    }

    if (
      (currentChunk + sentence).length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());

      // overlap分だけ末尾の文を残す
      let overlapChunk = "";
      if (overlap > 0) {
        // currentChunkの後ろから overlap 文字分程度を取得
        overlapChunk = currentChunk.slice(-overlap);
      }
      currentChunk = overlapChunk + sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
