import { apiClient } from "../api-client.js";
import { parseResponseError } from "../errors.js";
import type { ReindexProgressEvent, VectorIndexStatus } from "../types.js";

function isVectorIndexStatus(value: unknown): value is VectorIndexStatus {
  return (
    typeof value === "object" &&
    value !== null &&
    "indexDimensions" in value &&
    "requiredDimensions" in value &&
    "match" in value &&
    typeof (value as { indexDimensions: unknown }).indexDimensions ===
      "number" &&
    typeof (value as { requiredDimensions: unknown }).requiredDimensions ===
      "number" &&
    typeof (value as { match: unknown }).match === "boolean"
  );
}

export async function getVectorIndexStatus(): Promise<VectorIndexStatus> {
  const res = await apiClient.vector.status.$get();
  if (!res.ok) {
    throw await parseResponseError(res, "ベクトルインデックス状態の確認");
  }
  const data: unknown = await res.json();
  if (!isVectorIndexStatus(data)) {
    throw new Error("ベクトルインデックス状態の形式が不正です");
  }
  return data;
}

export async function streamReindex(
  options: {
    embeddingConfigId?: string | null;
    onProgress: (event: ReindexProgressEvent) => void;
    onDone: (result?: unknown) => void;
    onError: (error: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/vector/reindex`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeddingConfigId: options.embeddingConfigId ?? null,
    }),
    signal,
  });

  if (!response.ok) {
    throw await parseResponseError(response, "ベクトルの再インデックス開始");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("ReadableStream not supported");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "message";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const dataStr = line.slice(5).trim();
          if (!dataStr) {
            continue;
          }
          try {
            const data = JSON.parse(dataStr);
            if (currentEvent === "progress") {
              options.onProgress(data as ReindexProgressEvent);
            } else if (currentEvent === "done") {
              options.onDone(data.result);
            } else if (currentEvent === "error") {
              options.onError(data.error ?? "Unknown reindexing error");
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
