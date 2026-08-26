import { timelineClient } from '../grpc-client.js';
import type { CreateTimelineInput, Timeline } from '../types.js';

export async function fetchTimelines(novelId: string): Promise<Timeline[]> {
  const res = await timelineClient.listTimelines({ novelId });
  return res.timelines.map((t) => ({
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
  const res = await timelineClient.createTimeline({
    novelId,
    sectionId: input.sectionId,
    event: input.event,
    order: input.order,
    timestamp: input.timestamp,
  });
  return {
    id: res.id,
    novelId: res.novelId,
    sectionId: res.sectionId ?? null,
    event: res.event,
    order: res.order,
    timestamp: res.timestamp ?? null,
    createdAt: res.createdAt ?? null,
  };
}

export async function deleteTimeline(id: string): Promise<void> {
  await timelineClient.deleteTimeline({ id });
}
