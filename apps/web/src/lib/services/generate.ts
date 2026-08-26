import { generateClient } from '../grpc-client.js';
import type { ExtractResult, GeneratedPlot, GeneratedSummary } from '../types.js';

export async function generatePlot(novelId: string): Promise<GeneratedPlot> {
  const res = await generateClient.generatePlot({ novelId });
  return {
    title: res.title,
    description: res.description,
    chapters: res.chapters.map((ch) => ({
      title: ch.title,
      order: ch.order,
      summary: ch.summary,
    })),
  };
}

export async function generateChapterSummary(chapterId: string): Promise<GeneratedSummary> {
  const res = await generateClient.generateChapterSummary({ chapterId });
  return {
    title: res.title,
    order: res.order,
    summary: res.summary,
  };
}

export async function generateSectionSummary(sectionId: string): Promise<GeneratedSummary> {
  const res = await generateClient.generateSectionSummary({ sectionId });
  return {
    title: res.title,
    order: res.order,
    summary: res.summary,
  };
}

export async function* generateSectionContent(sectionId: string): AsyncIterable<string> {
  for await (const res of generateClient.generateSectionContent({ sectionId })) {
    yield res.chunk;
  }
}

export async function extractEntities(sectionId: string): Promise<ExtractResult> {
  const res = await generateClient.extractEntities({ sectionId });
  return {
    timelines: res.timelines.map((t) => ({
      id: '',
      novelId: '',
      sectionId: null,
      event: t.event,
      order: t.order,
      timestamp: t.timestamp || null,
      createdAt: null,
    })),
    settings: res.settings.map((s) => ({
      id: '',
      novelId: '',
      category: s.category,
      name: s.name,
      description: s.description || null,
      metadata: {},
      createdAt: null,
      updatedAt: null,
    })),
  };
}
