export interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChatOptions {
  sessionId?: string | null;
  novelId?: string | null;
  messages: ChatMessagePayload[];
  signal?: AbortSignal;
  onChunk: (chunkText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * 創作相談チャットの SSE ストリームを受信する。
 */
export async function streamChat({
  sessionId,
  novelId,
  messages,
  signal,
  onChunk,
  onError,
}: StreamChatOptions): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      sessionId: sessionId || undefined,
      novelId: novelId || undefined,
      messages,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'チャットリクエストに失敗しました');
    const err = new Error(errorText || `HTTP ${response.status}`);
    onError?.(err);
    throw err;
  }

  const body = response.body;
  if (!body) {
    const err = new Error('レスポンスボディが取得できませんでした');
    onError?.(err);
    throw err;
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
          const parsed = JSON.parse(data) as {
            text?: string;
            done?: boolean;
            error?: string;
          };

          if (parsed.error) {
            const err = new Error(parsed.error);
            onError?.(err);
            throw err;
          }

          if (parsed.text) {
            onChunk(parsed.text);
          }

          if (parsed.done) {
            return;
          }
        } catch (e) {
          if (e instanceof Error && parsedError(data)) {
            throw e;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parsedError(data: string): boolean {
  try {
    const p = JSON.parse(data) as { error?: string };
    return Boolean(p.error);
  } catch {
    return false;
  }
}
