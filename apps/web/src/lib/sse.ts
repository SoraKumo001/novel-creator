interface SSEChunk {
  text?: string;
  done?: boolean;
}

export interface SSEExtractResult {
  timelines: { event: string; order: number; timestamp: string | null }[];
  settings: { category: string; name: string; description: string }[];
}

/**
 * 本文生成の SSE ストリームを fetch + ReadableStream で受信する。
 * チャンクごとに onChunk コールバックを呼び出す。
 */
export async function streamGenerateContent(
  sectionId: string,
  onChunk: (text: string) => void,
): Promise<void> {
  const response = await fetch(`/api/sections/${sectionId}/generate/content`, {
    method: 'POST',
    headers: { Accept: 'text/event-stream' },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to generate content');
    throw new Error(message);
  }

  const body = response.body;
  if (!body) {
    throw new Error('Response body is not available');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        if (!data) continue;
        try {
          const chunk = JSON.parse(data) as SSEChunk;
          if (chunk.text) {
            onChunk(chunk.text);
          }
          if (chunk.done) {
            return;
          }
        } catch {
          // パース不能な行は無視する。
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 本文生成 + 自動整合性更新（content-auto）の SSE ストリームを受信する。
 * 本文チャンクは onChunk に渡し、最後の extract イベントの抽出結果を返す。
 */
export async function streamGenerateContentAuto(
  sectionId: string,
  onChunk: (text: string) => void,
): Promise<SSEExtractResult> {
  const response = await fetch(`/api/sections/${sectionId}/generate/content-auto`, {
    method: 'POST',
    headers: { Accept: 'text/event-stream' },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to generate content');
    throw new Error(message);
  }

  const body = response.body;
  if (!body) {
    throw new Error('Response body is not available');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let extractResult: SSEExtractResult | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      // イベント単位で処理するため、空行で区切られたブロックを解析する。
      const blocks = lines.join('\n').split('\n\n');
      for (const block of blocks) {
        const eventLine = block.split('\n').find((l) => l.startsWith('event:'));
        const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const data = dataLine.slice(5).trim();
        if (!data) continue;
        const event = eventLine ? eventLine.slice(6).trim() : 'message';
        try {
          if (event === 'chunk') {
            const chunk = JSON.parse(data) as SSEChunk;
            if (chunk.text) onChunk(chunk.text);
          } else if (event === 'extract') {
            extractResult = JSON.parse(data) as SSEExtractResult;
          } else if (event === 'done') {
            return extractResult ?? { timelines: [], settings: [] };
          }
        } catch {
          // パース不能な行は無視する。
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return extractResult ?? { timelines: [], settings: [] };
}

/**
 * 日本語／英語混在のテキストのおおよその文字数・単語数を返す。
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const japanese = trimmed.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g);
  if (japanese && japanese.length > 0) {
    return japanese.length;
  }
  return trimmed.split(/\s+/).length;
}
