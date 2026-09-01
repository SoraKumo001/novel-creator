import { apiClient } from "../api-client.js";
import { parseResponseError } from "../errors.js";
import type {
  Chapter,
  ChapterWithSections,
  CreateChapterInput,
  CreateSectionInput,
  Section,
  UpdateChapterInput,
} from "../types.js";

export async function fetchChapters(
  novelId: string
): Promise<ChapterWithSections[]> {
  const res = await apiClient.novels[":id"].chapters.$get({
    param: { id: novelId },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "章一覧の取得");
  }
  const chapters = await res.json();
  const results: ChapterWithSections[] = [];
  for (const ch of chapters) {
    const detailRes = await apiClient.chapters[":id"].$get({
      param: { id: ch.id },
    });
    if (detailRes.ok) {
      const detail = await detailRes.json();
      results.push({
        id: detail.id,
        novelId: detail.novelId,
        title: detail.title,
        order: detail.order,
        summary: detail.summary ?? null,
        createdAt: detail.createdAt ?? null,
        updatedAt: detail.updatedAt ?? null,
        sections: detail.sections.map((s) => ({
          id: s.id,
          chapterId: s.chapterId,
          title: s.title ?? null,
          order: s.order,
          summary: s.summary ?? null,
          createdAt: s.createdAt ?? null,
          updatedAt: s.updatedAt ?? null,
        })),
      });
    }
  }
  return results;
}

export async function fetchChapter(id: string): Promise<ChapterWithSections> {
  const res = await apiClient.chapters[":id"].$get({ param: { id } });
  if (!res.ok) {
    throw await parseResponseError(res, "章詳細の取得");
  }
  const detail = await res.json();
  return {
    id: detail.id,
    novelId: detail.novelId,
    title: detail.title,
    order: detail.order,
    summary: detail.summary ?? null,
    createdAt: detail.createdAt ?? null,
    updatedAt: detail.updatedAt ?? null,
    sections: detail.sections.map((s) => ({
      id: s.id,
      chapterId: s.chapterId,
      title: s.title ?? null,
      order: s.order,
      summary: s.summary ?? null,
      createdAt: s.createdAt ?? null,
      updatedAt: s.updatedAt ?? null,
    })),
  };
}

export async function createChapter(
  novelId: string,
  input: CreateChapterInput
): Promise<Chapter> {
  const res = await apiClient.novels[":id"].chapters.$post({
    param: { id: novelId },
    json: {
      title: input.title,
      order: input.order,
      summary: input.summary,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "章の作成");
  }
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    title: row.title,
    order: row.order,
    summary: row.summary ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function updateChapter(
  id: string,
  input: UpdateChapterInput
): Promise<Chapter> {
  const res = await apiClient.chapters[":id"].$put({
    param: { id },
    json: {
      title: input.title,
      order: input.order,
      summary: input.summary,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "章の更新");
  }
  const row = await res.json();
  return {
    id: row.id,
    novelId: row.novelId,
    title: row.title,
    order: row.order,
    summary: row.summary ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function deleteChapter(id: string): Promise<void> {
  const res = await apiClient.chapters[":id"].$delete({ param: { id } });
  if (!res.ok) {
    throw await parseResponseError(res, "章の削除");
  }
}

export async function createSection(
  chapterId: string,
  input: CreateSectionInput
): Promise<Section> {
  const res = await apiClient.chapters[":id"].sections.$post({
    param: { id: chapterId },
    json: {
      title: input.title,
      order: input.order,
      summary: input.summary,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "節の作成");
  }
  const row = await res.json();
  return {
    id: row.id,
    chapterId: row.chapterId,
    title: row.title ?? null,
    order: row.order,
    summary: row.summary ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}
