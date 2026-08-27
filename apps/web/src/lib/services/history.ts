import { historyClient } from '../grpc-client.js';

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
  const res = await historyClient.listHistories({
    novelId,
    entityType: options?.entityType,
    entityId: options?.entityId,
    limit: options?.limit,
  });

  return res.histories.map((h) => ({
    id: h.id,
    novelId: h.novelId,
    entityType: h.entityType,
    entityId: h.entityId,
    title: h.title,
    content: h.content,
    description: h.description,
    wordCount: h.wordCount,
    createdAt: h.createdAt,
  }));
}

export async function fetchHistory(id: string): Promise<HistoryItem> {
  const h = await historyClient.getHistory({ id });
  return {
    id: h.id,
    novelId: h.novelId,
    entityType: h.entityType,
    entityId: h.entityId,
    title: h.title,
    content: h.content,
    description: h.description,
    wordCount: h.wordCount,
    createdAt: h.createdAt,
  };
}

export async function restoreHistory(id: string): Promise<{ success: boolean; message: string }> {
  const res = await historyClient.restoreHistory({ id });
  return {
    success: res.success,
    message: res.message,
  };
}
