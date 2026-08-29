import { apiClient } from '../api-client.js';
import type { ExtractResult, GeneratedPlot, GeneratedSummary } from '../types.js';

export async function generatePlot(
  novelId: string,
  modelConfigId?: string | null,
): Promise<GeneratedPlot> {
  const res = await apiClient.novels[':id'].generate.plot.$post({
    param: { id: novelId },
    json: { modelConfigId: modelConfigId || null },
  });

  if (!res.ok) throw new Error('Failed to generate plot');
  const data = await res.json();
  return {
    title: data.title,
    description: data.description,
    chapters: data.chapters.map((ch) => ({
      title: ch.title,
      order: ch.order,
      summary: ch.summary,
    })),
  };
}

export async function generateChapterSummary(chapterId: string): Promise<GeneratedSummary> {
  const res = await apiClient.chapters[':id'].generate.summary.$post({
    param: { id: chapterId },
  });
  if (!res.ok) throw new Error('Failed to generate chapter summary');
  const data = await res.json();
  return {
    title: data.title,
    order: data.order,
    summary: data.summary,
  };
}

export async function generateSectionSummary(sectionId: string): Promise<GeneratedSummary> {
  const res = await apiClient.sections[':id'].generate.summary.$post({
    param: { id: sectionId },
  });
  if (!res.ok) throw new Error('Failed to generate section summary');
  const data = await res.json();
  return {
    title: data.title,
    order: data.order,
    summary: data.summary,
  };
}

export async function* generateSectionContent(
  sectionId: string,
  modelConfigId?: string | null,
): AsyncIterable<string> {
  const res = await apiClient.sections[':id'].generate.content.$post({
    param: { id: sectionId },
    json: { modelConfigId: modelConfigId || null },
  });
  if (!res.ok || !res.body) {
    throw new Error('Failed to generate section content');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.done) return;
            if (data.text) yield data.text;
          } catch {
            // ignore JSON parse error
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function proofreadSectionContent(
  sectionId: string,
  customBody?: string,
  modelConfigId?: string | null,
) {
  const res = await apiClient.sections[':id'].generate.proofread.$post({
    param: { id: sectionId },
    json: { body: customBody, modelConfigId: modelConfigId || null },
  });
  if (!res.ok) throw new Error('Failed to proofread content');
  return res.json();
}

export async function extractEntities(sectionId: string): Promise<ExtractResult> {
  const res = await apiClient.sections[':id'].generate.extract.$post({
    param: { id: sectionId },
  });
  if (!res.ok) throw new Error('Failed to extract entities');
  const data = await res.json();
  return {
    timelines: data.timelines.map((t) => ({
      event: t.event,
      order: t.order,
      timestamp: t.timestamp ?? null,
    })),
    settings: data.settings.map((s) => ({
      category: s.category,
      name: s.name,
      description: s.description ?? null,
    })),
  };
}

export async function* inlineAssistSectionContent(
  sectionId: string,
  input: {
    selectedText: string;
    action: 'expand' | 'shorten' | 'emotional' | 'dialogue' | 'paraphrase' | 'custom';
    customInstruction?: string;
    surroundingText?: string;
    modelConfigId?: string | null;
  },
): AsyncIterable<string> {
  const res = await apiClient.sections[':id'].generate['inline-assist'].$post({
    param: { id: sectionId },
    json: {
      selectedText: input.selectedText,
      action: input.action,
      customInstruction: input.customInstruction,
      surroundingText: input.surroundingText,
      modelConfigId: input.modelConfigId || null,
    },
  });

  if (!res.ok || !res.body) {
    throw new Error('Failed to generate inline assist content');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.done) return;
            if (data.text) yield data.text;
          } catch {
            // ignore JSON parse error
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function checkCharacterVoice(
  novelId: string,
  body?: string,
  modelConfigId?: string | null,
) {
  const res = await apiClient.novels[':id'].generate['check-voice'].$post({
    param: { id: novelId },
    json: { body, modelConfigId: modelConfigId || null },
  });
  if (!res.ok) throw new Error('Failed to check character voice');
  return res.json();
}

export async function analyzeSettingImpact(
  novelId: string,
  input: {
    changeTarget: 'character' | 'setting';
    targetName: string;
    beforeValue: string;
    afterValue: string;
    modelConfigId?: string | null;
  },
) {
  const res = await apiClient.novels[':id'].generate.impact.$post({
    param: { id: novelId },
    json: {
      changeTarget: input.changeTarget,
      targetName: input.targetName,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue,
      modelConfigId: input.modelConfigId || null,
    },
  });
  if (!res.ok) throw new Error('Failed to analyze setting impact');
  return res.json();
}

export async function analyzeStoryArc(novelId: string, modelConfigId?: string | null) {
  const res = await apiClient.novels[':id'].generate['story-arc'].$post({
    param: { id: novelId },
    json: { modelConfigId: modelConfigId || null },
  });
  if (!res.ok) throw new Error('Failed to analyze story arc');
  return res.json();
}

export async function multiPersonaReview(
  novelId: string,
  input: {
    sectionId?: string;
    chapterId?: string;
    body?: string;
    modelConfigId?: string | null;
  },
) {
  const res = await apiClient.novels[':id'].generate['persona-review'].$post({
    param: { id: novelId },
    json: {
      sectionId: input.sectionId,
      chapterId: input.chapterId,
      body: input.body,
      modelConfigId: input.modelConfigId || null,
    },
  });
  if (!res.ok) throw new Error('Failed to generate multi-persona review');
  return res.json();
}
