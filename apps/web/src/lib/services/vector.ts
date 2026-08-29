import type { ReindexProgressEvent } from '../types.js';

export async function streamReindex(
  options: {
    embeddingConfigId?: string | null;
    onProgress: (event: ReindexProgressEvent) => void;
    onDone: (result?: unknown) => void;
    onError: (error: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/vector/reindex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeddingConfigId: options.embeddingConfigId ?? null }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to start reindexing: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('ReadableStream not supported');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = 'message';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            if (currentEvent === 'progress') {
              options.onProgress(data as ReindexProgressEvent);
            } else if (currentEvent === 'done') {
              options.onDone(data.result);
            } else if (currentEvent === 'error') {
              options.onError(data.error ?? 'Unknown reindexing error');
            }
          } catch {
            // JSON parse error
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
