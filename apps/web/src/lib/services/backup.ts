import { backupClient } from '../grpc-client.js';
import type { ImportResult } from '../types.js';

export async function exportNovelBackup(novelId: string): Promise<Response> {
  const res = await backupClient.exportNovel({ novelId });
  const blob = new Blob([res.jsonData], { type: 'application/json' });
  return new Response(blob, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function importNovelBackup(
  data: unknown,
): Promise<{ json: () => Promise<ImportResult> }> {
  const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
  const res = await backupClient.importNovel({ jsonData });
  return {
    json: async () => ({
      success: true as const,
      novelId: res.novelId,
      counts: {},
    }),
  };
}
