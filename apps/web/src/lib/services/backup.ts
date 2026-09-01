import { apiClient } from "../api-client.js";
import { parseResponseError } from "../errors.js";
import type { ImportResult } from "../types.js";

export async function exportNovelBackup(novelId: string): Promise<Response> {
  const res = await apiClient.backup.export.$post({
    query: { novelId },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "バックアップのエクスポート");
  }
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  return new Response(blob, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function importNovelBackup(data: unknown): Promise<ImportResult> {
  const parsedData = typeof data === "string" ? JSON.parse(data) : data;
  const res = await apiClient.backup.import.$post({
    // バックアップ JSON は任意ファイル由来のため動的に parse する。
    // 検証の権威は API 側（backupBodySchema）であり、ここでは構造を緩く扱う。
    json: parsedData,
  });
  if (!res.ok) {
    throw await parseResponseError(res, "バックアップのインポート");
  }
  const result = await res.json();
  return {
    success: true as const,
    novelId: result.novelId,
    counts: result.counts,
  };
}
