import { apiClient } from '../api-client.js';
import type { CreateNovelInput, Novel, NovelDetail, UpdateNovelInput } from '../types.js';

export async function fetchNovels(): Promise<Novel[]> {
  const res = await apiClient.novels.$get();
  if (!res.ok) throw new Error('Failed to fetch novels');
  const rows = await res.json();
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description ?? null,
    createdAt: n.createdAt ?? null,
    updatedAt: n.updatedAt ?? null,
  }));
}

export async function fetchNovelDetail(id: string): Promise<NovelDetail> {
  const res = await apiClient.novels[':id'].$get({ param: { id } });
  if (!res.ok) throw new Error('Failed to fetch novel detail');
  const n = await res.json();
  return {
    id: n.id,
    title: n.title,
    description: n.description ?? null,
    createdAt: n.createdAt ?? null,
    updatedAt: n.updatedAt ?? null,
    chapters: n.chapters.map((ch) => ({
      id: ch.id,
      novelId: ch.novelId,
      title: ch.title,
      order: ch.order,
      summary: ch.summary ?? null,
      createdAt: ch.createdAt ?? null,
      updatedAt: ch.updatedAt ?? null,
    })),
    characters: n.characters.map((c) => ({
      id: c.id,
      novelId: c.novelId,
      category: c.category,
      name: c.name,
      description: c.description ?? null,
      traits: (c.traits as string[] | null) ?? null,
      relationships: (c.relationships as Record<string, unknown>) ?? {},
      createdAt: c.createdAt ?? null,
      updatedAt: c.updatedAt ?? null,
    })),
    settings: n.settings.map((s) => ({
      id: s.id,
      novelId: s.novelId,
      category: s.category,
      name: s.name,
      description: s.description ?? null,
      metadata: (s.metadata as Record<string, unknown>) ?? {},
      createdAt: s.createdAt ?? null,
      updatedAt: s.updatedAt ?? null,
    })),
  };
}

export async function createNovel(input: CreateNovelInput): Promise<Novel> {
  const res = await apiClient.novels.$post({
    json: {
      title: input.title,
      description: input.description,
    },
  });
  if (!res.ok) throw new Error('Failed to create novel');
  const row = await res.json();
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function updateNovel(id: string, input: UpdateNovelInput): Promise<Novel> {
  const res = await apiClient.novels[':id'].$put({
    param: { id },
    json: {
      title: input.title,
      description: input.description,
    },
  });
  if (!res.ok) throw new Error('Failed to update novel');
  const row = await res.json();
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function deleteNovel(id: string): Promise<void> {
  const res = await apiClient.novels[':id'].$delete({ param: { id } });
  if (!res.ok) throw new Error('Failed to delete novel');
}

export async function fetchNovelExportData(id: string) {
  const [novelRes, chaptersRes] = await Promise.all([
    apiClient.novels[':id'].$get({ param: { id } }),
    apiClient.novels[':id'].chapters.$get({ param: { id } }),
  ]);

  if (!novelRes.ok) throw new Error('Failed to fetch novel data');
  if (!chaptersRes.ok) throw new Error('Failed to fetch chapters');

  const novel = await novelRes.json();
  const rawChapters = await chaptersRes.json();

  const chaptersWithSections = await Promise.all(
    rawChapters.map(async (ch) => {
      const chDetailRes = await apiClient.chapters[':id'].$get({
        param: { id: ch.id },
      });
      const chDetail = chDetailRes.ok ? await chDetailRes.json() : null;
      const rawSections = chDetail?.sections ?? [];

      const sectionsWithContent = await Promise.all(
        rawSections.map(async (sec) => {
          const contentRes = await apiClient.contents[':id'].$get({
            param: { id: sec.id },
          });
          const contentData = contentRes.ok ? await contentRes.json() : null;
          return {
            title: sec.title ?? null,
            order: sec.order,
            content: contentData?.body ?? null,
          };
        }),
      );

      return {
        title: ch.title,
        order: ch.order,
        sections: sectionsWithContent,
      };
    }),
  );

  return {
    title: novel.title,
    description: novel.description ?? null,
    chapters: chaptersWithSections,
  };
}
