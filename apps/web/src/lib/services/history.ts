import { apiClient } from '../api-client.js';

export interface HistoryItem {
  id: string;
  novelId: string;
  entityType: string;
  entityId: string;
  title: string;
  content: string;
  description: string;
  wordCount?: number;
  createdAt: string;
}

export async function fetchHistories(
  novelId: string,
  options?: { entityType?: string; entityId?: string; limit?: number },
): Promise<HistoryItem[]> {
  const res = await apiClient.histories.$get({
    query: {
      novelId,
      entityType: options?.entityType,
      entityId: options?.entityId,
      limit: options?.limit !== undefined ? String(options.limit) : undefined,
    },
  });
  if (!res.ok) throw new Error('Failed to fetch histories');
  const rows = await res.json();
  return rows.map((h) => ({
    id: h.id,
    novelId: h.novelId,
    entityType: h.entityType,
    entityId: h.entityId,
    title: h.title,
    content: h.content,
    description: h.description,
    wordCount: h.wordCount ?? undefined,
    createdAt: typeof h.createdAt === 'string' ? h.createdAt : new Date(h.createdAt).toISOString(),
  }));
}

export async function fetchHistory(id: string): Promise<HistoryItem> {
  const res = await apiClient.histories[':id'].$get({ param: { id } });
  if (!res.ok) throw new Error('Failed to fetch history');
  const h = await res.json();
  return {
    id: h.id,
    novelId: h.novelId,
    entityType: h.entityType,
    entityId: h.entityId,
    title: h.title,
    content: h.content,
    description: h.description,
    wordCount: h.wordCount ?? undefined,
    createdAt: typeof h.createdAt === 'string' ? h.createdAt : new Date(h.createdAt).toISOString(),
  };
}

export async function restoreHistory(id: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.histories[':id'].restore.$post({ param: { id } });
  if (!res.ok) throw new Error('Failed to restore history');
  const result = await res.json();
  return {
    success: result.success,
    message: result.message,
  };
}
