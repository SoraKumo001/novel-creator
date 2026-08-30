import { parseResponseError } from '../errors.js';
import { apiClient } from '../api-client.js';
import type { ImportResult } from '../types.js';
import type { BackupBody } from '@novel-creator/api';

export async function exportNovelBackup(novelId: string): Promise<Response> {
  const res = await apiClient.backup.export.$post({
    query: { novelId },
  });
  if (!res.ok) throw await parseResponseError(res, 'バックアップのエクスポート');
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  return new Response(blob, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function importNovelBackup(data: unknown): Promise<ImportResult> {
  const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
  const res = await apiClient.backup.import.$post({
    // API 側（backupBodySchema）が検証の権威。web 側は構造を緩く扱うため unknown 経由でブリッジする。
    json: parsedData as unknown as BackupBody,
  });
  if (!res.ok) throw await parseResponseError(res, 'バックアップのインポート');
  const result = await res.json();
  return {
    success: true as const,
    novelId: result.novelId,
    counts: result.counts,
  };
}
