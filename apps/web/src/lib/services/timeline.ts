import { parseResponseError } from '../errors.js';
import { apiClient } from '../api-client.js';
import type { CreateTimelineInput, Timeline, UpdateTimelineInput } from '../types.js';

export async function fetchTimelines(novelId: string): Promise<Timeline[]> {
  const res = await apiClient.novels[':id'].timelines.$get({ param: { id: novelId } });
  if (!res.ok) throw await parseResponseError(res, 'タイムライン一覧の取得');
  const rows = await res.json();
  return rows.map((t) => ({
    id: t.id,
    novelId: t.novelId,
    sectionId: t.sectionId ?? null,
    event: t.event,
    order: t.order,
    timestamp: t.timestamp ?? null,
    createdAt: t.createdAt ?? null,
  }));
}

export async function createTimeline(
  novelId: string,
  input: CreateTimelineInput,
): Promise<Timeline> {
  const res = await apiClient.novels[':id'].timelines.$post({
    param: { id: novelId },
    json: {
      sectionId: input.sectionId,
      event: input.event,
      order: input.order,
      timestamp: input.timestamp,
    },
  });
  if (!res.ok) throw await parseResponseError(res, 'タイムラインの作成');
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    sectionId: row.sectionId ?? null,
    event: row.event,
    order: row.order,
    timestamp: row.timestamp ?? null,
    createdAt: row.createdAt ?? null,
  };
}

export async function updateTimeline(id: string, input: UpdateTimelineInput): Promise<Timeline> {
  const res = await apiClient.timelines[':id'].$put({
    param: { id },
    json: {
      sectionId: input.sectionId,
      event: input.event,
      order: input.order,
      timestamp: input.timestamp,
    },
  });
  if (!res.ok) throw await parseResponseError(res, 'タイムラインの更新');
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    sectionId: row.sectionId ?? null,
    event: row.event,
    order: row.order,
    timestamp: row.timestamp ?? null,
    createdAt: row.createdAt ?? null,
  };
}

export async function deleteTimeline(id: string): Promise<void> {
  const res = await apiClient.timelines[':id'].$delete({ param: { id } });
  if (!res.ok) throw await parseResponseError(res, 'タイムラインの削除');
}
