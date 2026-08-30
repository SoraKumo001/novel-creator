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
    styleGuide: n.styleGuide ?? null,
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
    styleGuide: n.styleGuide ?? null,
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
      styleGuide: input.styleGuide ?? undefined,
    },
  });
  if (!res.ok) throw new Error('Failed to create novel');
  const row = await res.json();
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    styleGuide: row.styleGuide ?? null,
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
      styleGuide: input.styleGuide,
      storyOutline: input.storyOutline,
    },
  });
  if (!res.ok) throw new Error('Failed to update novel');
  const row = await res.json();
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    styleGuide: row.styleGuide ?? null,
    storyOutline: row.storyOutline ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function fetchStoryOutline(id: string): Promise<string> {
  const res = await apiClient.novels[':id']['story-outline'].markdown.$get({
    param: { id },
  });
  if (!res.ok) throw new Error('Failed to fetch story outline');
  const data = await res.json();
  return data.markdown;
}

export async function saveStoryOutline(id: string, markdown: string): Promise<Novel> {
  const res = await apiClient.novels[':id']['story-outline'].markdown.$put({
    param: { id },
    json: { markdown },
  });
  if (!res.ok) throw new Error('Failed to save story outline');
  const data = await res.json();
  return {
    id: data.novel.id,
    title: data.novel.title,
    description: data.novel.description ?? null,
    styleGuide: data.novel.styleGuide ?? null,
    storyOutline: data.novel.storyOutline ?? null,
    createdAt: data.novel.createdAt ?? null,
    updatedAt: data.novel.updatedAt ?? null,
  };
}

export async function editStoryOutlineSection(
  id: string,
  params: {
    activeSection: { category: string; name: string; content: string };
    instruction: string;
    markdown: string;
    modelConfigId?: string | null;
  },
): Promise<string> {
  const res = await apiClient.novels[':id']['story-outline']['edit-section'].$post({
    param: { id },
    json: {
      category: params.activeSection.category,
      name: params.activeSection.name,
      content: params.activeSection.content,
      instruction: params.instruction,
      markdown: params.markdown,
      modelConfigId: params.modelConfigId ?? undefined,
    },
  });
  if (!res.ok) throw new Error('Failed to edit story outline section');
  const data = await res.json();
  return data.content;
}

export async function editStoryOutlineDocument(
  id: string,
  params: {
    instruction: string;
    markdown: string;
    modelConfigId?: string | null;
  },
): Promise<string> {
  const res = await apiClient.novels[':id']['story-outline']['edit-document'].$post({
    param: { id },
    json: {
      instruction: params.instruction,
      markdown: params.markdown,
      modelConfigId: params.modelConfigId ?? undefined,
    },
  });
  if (!res.ok) throw new Error('Failed to edit story outline document');
  const data = await res.json();
  return data.markdown;
}

export async function generatePlotFromStoryOutline(
  id: string,
  params: {
    storyOutline: string;
    modelConfigId?: string | null;
  },
): Promise<{
  title: string;
  description: string;
  chapters: { title: string; order: number; summary: string }[];
}> {
  const res = await apiClient.novels[':id']['story-outline']['generate-plot'].$post({
    param: { id },
    json: {
      storyOutline: params.storyOutline,
      modelConfigId: params.modelConfigId ?? undefined,
    },
  });
  if (!res.ok) throw new Error('Failed to generate plot from story outline');
  return res.json();
}

export async function generateStyleGuideDraft(
  novelId: string,
  modelConfigId?: string | null,
): Promise<string> {
  const res = await apiClient.novels[':id'].generate['style-guide'].$post({
    param: { id: novelId },
    json: { modelConfigId: modelConfigId ?? null },
  });
  if (!res.ok) throw new Error('Failed to generate style guide draft');
  const data = await res.json();
  return data.draft;
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
