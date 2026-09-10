import { apiClient } from "../api-client.js";
import { parseResponseError } from "../errors.js";
import type { Content, UpdateContentInput } from "../types.js";

export async function fetchContent(sectionId: string): Promise<Content> {
  const res = await apiClient.contents[":id"].$get({
    param: { id: sectionId },
  });
  if (res.status === 404) {
    // 未作成セクション（contents 行なし）は空本文として扱う。初回保存時に upsert される。
    return {
      body: "",
      createdAt: null,
      id: "",
      sectionId,
      updatedAt: null,
      wordCount: 0,
    };
  }
  if (!res.ok) {
    throw await parseResponseError(res, "本文の取得");
  }
  const data = await res.json();
  return {
    id: data.id,
    sectionId: data.sectionId,
    body: data.body,
    wordCount: data.wordCount ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function updateContent(
  sectionId: string,
  input: UpdateContentInput
): Promise<Content> {
  const res = await apiClient.contents[":id"].$put({
    param: { id: sectionId },
    json: {
      body: input.body,
      ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
    },
  });
  if (!res.ok) {
    throw await parseResponseError(res, "本文の更新");
  }
  const data = await res.json();
  return {
    id: data.id,
    sectionId: data.sectionId,
    body: data.body,
    wordCount: data.wordCount ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}
