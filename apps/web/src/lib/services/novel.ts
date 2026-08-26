import { novelClient } from '../grpc-client.js';
import type { CreateNovelInput, Novel, NovelDetail, UpdateNovelInput } from '../types.js';

function parseJsonSafe<T = unknown>(str?: string, defaultValue: unknown = {}): T {
  if (!str) return defaultValue as T;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue as T;
  }
}

export async function fetchNovels(): Promise<Novel[]> {
  const res = await novelClient.listNovels({});
  return res.novels.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description ?? null,
    createdAt: n.createdAt ?? null,
    updatedAt: n.updatedAt ?? null,
  }));
}

export async function fetchNovelDetail(id: string): Promise<NovelDetail> {
  const res = await novelClient.getNovelDetail({ id });
  const n = res.novel!;
  return {
    id: n.id,
    title: n.title,
    description: n.description ?? null,
    createdAt: n.createdAt ?? null,
    updatedAt: n.updatedAt ?? null,
    chapters: res.chapters.map((ch) => ({
      id: ch.id,
      novelId: ch.novelId,
      title: ch.title,
      order: ch.order,
      summary: ch.summary ?? null,
      createdAt: ch.createdAt ?? null,
      updatedAt: ch.updatedAt ?? null,
    })),
    characters: res.characters.map((c) => ({
      id: c.id,
      novelId: c.novelId,
      category: c.category,
      name: c.name,
      description: c.description ?? null,
      traits: c.traits,
      relationships: parseJsonSafe(c.relationshipsJson),
      createdAt: c.createdAt ?? null,
      updatedAt: c.updatedAt ?? null,
    })),
    settings: res.settings.map((s) => ({
      id: s.id,
      novelId: s.novelId,
      category: s.category,
      name: s.name,
      description: s.description ?? null,
      metadata: parseJsonSafe(s.metadataJson),
      createdAt: s.createdAt ?? null,
      updatedAt: s.updatedAt ?? null,
    })),
  };
}

export async function createNovel(input: CreateNovelInput): Promise<Novel> {
  const res = await novelClient.createNovel({
    title: input.title,
    description: input.description,
  });
  return {
    id: res.id,
    title: res.title,
    description: res.description ?? null,
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function updateNovel(id: string, input: UpdateNovelInput): Promise<Novel> {
  const res = await novelClient.updateNovel({
    id,
    title: input.title,
    description: input.description,
  });
  return {
    id: res.id,
    title: res.title,
    description: res.description ?? null,
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt ?? null,
  };
}

export async function deleteNovel(id: string): Promise<void> {
  await novelClient.deleteNovel({ id });
}
