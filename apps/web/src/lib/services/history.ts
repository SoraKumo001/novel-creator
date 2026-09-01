import { apiClient } from "../api-client.js";
import { parseResponseError } from "../errors.js";

export interface HistoryItem {
  content: string;
  createdAt: string;
  description: string;
  entityId: string;
  entityType: string;
  id: string;
  novelId: string;
  title: string;
  wordCount?: number;
}

export async function fetchHistories(
  novelId: string,
  options?: { entityType?: string; entityId?: string; limit?: number }
): Promise<HistoryItem[]> {
  const res = await apiClient.histories.$get({
    query: {
      novelId,
      entityType: options?.entityType,
      entityId: options?.entityId,
      limit: options?.limit !== undefined ? String(options.limit) : undefined,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "編集履歴一覧の取得");
  }
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
    createdAt:
      typeof h.createdAt === "string"
        ? h.createdAt
        : new Date(h.createdAt).toISOString(),
  }));
}

export async function fetchHistory(id: string): Promise<HistoryItem> {
  const res = await apiClient.histories[":id"].$get({ param: { id } });
  if (!res.ok) {
    throw await parseResponseError(res, "編集履歴詳細の取得");
  }
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
    createdAt:
      typeof h.createdAt === "string"
        ? h.createdAt
        : new Date(h.createdAt).toISOString(),
  };
}

export async function restoreHistory(
  id: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.histories[":id"].restore.$post({ param: { id } });
  if (!res.ok) {
    throw await parseResponseError(res, "履歴の復元");
  }
  const result = await res.json();
  return {
    success: result.success,
    message: result.message,
  };
}
