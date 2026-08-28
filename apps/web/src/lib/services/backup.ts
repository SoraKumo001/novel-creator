import { apiClient } from '../api-client.js';
import type { ImportResult } from '../types.js';

export async function exportNovelBackup(novelId: string): Promise<Response> {
  const res = await apiClient.backup.export.$post({
    query: { novelId },
  });
  if (!res.ok) throw new Error('Failed to export novel backup');
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: parsedData as any,
  });
  if (!res.ok) throw new Error('Failed to import novel backup');
  const result = await res.json();
  return {
    success: true as const,
    novelId: result.novelId,
    counts: result.counts,
  };
}
