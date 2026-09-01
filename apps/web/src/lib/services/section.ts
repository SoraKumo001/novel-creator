import { apiClient } from "../api-client.js";
import { parseResponseError } from "../errors.js";
import type {
  Section,
  SectionWithContent,
  UpdateSectionInput,
} from "../types.js";

export async function fetchSection(id: string): Promise<SectionWithContent> {
  const res = await apiClient.sections[":id"].$get({ param: { id } });
  if (!res.ok) {
    throw await parseResponseError(res, "節詳細の取得");
  }
  const data = await res.json();
  return {
    id: data.id,
    chapterId: data.chapterId,
    title: data.title ?? null,
    order: data.order,
    summary: data.summary ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    content: data.content
      ? {
          id: data.content.id,
          sectionId: data.content.sectionId,
          body: data.content.body,
          wordCount: data.content.wordCount ?? null,
          createdAt: data.content.createdAt ?? null,
          updatedAt: data.content.updatedAt ?? null,
        }
      : null,
  };
}

export async function updateSection(
  id: string,
  input: UpdateSectionInput
): Promise<Section> {
  const res = await apiClient.sections[":id"].$put({
    param: { id },
    json: {
      title: input.title,
      order: input.order,
      summary: input.summary,
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "節の更新");
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

export async function deleteSection(id: string): Promise<void> {
  const res = await apiClient.sections[":id"].$delete({ param: { id } });
  if (!res.ok) {
    throw await parseResponseError(res, "節の削除");
  }
}
