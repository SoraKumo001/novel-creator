import { parseResponseError } from '../errors.js';
import { apiClient } from '../api-client.js';
import type { ExtractResult, GeneratedPlot, GeneratedSummary } from '../types.js';

export async function generatePlot(
  novelId: string,
  modelConfigId?: string | null,
  signal?: AbortSignal,
): Promise<GeneratedPlot> {
  const res = await apiClient.novels[':id'].generate.plot.$post(
    {
      param: { id: novelId },
      json: { modelConfigId: modelConfigId || null },
    },
    { init: { signal } },
  );

  if (!res.ok) throw await parseResponseError(res, 'プロット生成');
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

export async function generateChapterSummary(
  chapterId: string,
  signal?: AbortSignal,
): Promise<GeneratedSummary> {
  const res = await apiClient.chapters[':id'].generate.summary.$post(
    {
      param: { id: chapterId },
    },
    { init: { signal } },
  );
  if (!res.ok) throw await parseResponseError(res, '章のあらすじ生成');
  const data = await res.json();
  return {
    title: data.title,
    order: data.order,
    summary: data.summary,
  };
}

export async function generateSectionSummary(
  sectionId: string,
  signal?: AbortSignal,
): Promise<GeneratedSummary> {
  const res = await apiClient.sections[':id'].generate.summary.$post(
    {
      param: { id: sectionId },
    },
    { init: { signal } },
  );
  if (!res.ok) throw await parseResponseError(res, '節のあらすじ生成');
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
  signal?: AbortSignal,
): AsyncIterable<string> {
  const res = await apiClient.sections[':id'].generate.content.$post(
    {
      param: { id: sectionId },
      json: { modelConfigId: modelConfigId || null },
    },
    { init: { signal } },
  );
  if (!res.ok) {
    throw await parseResponseError(res, '本文生成');
  }
  if (!res.body) {
    throw new Error('レスポンスボディが空です');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;
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
  signal?: AbortSignal,
) {
  const res = await apiClient.sections[':id'].generate.proofread.$post(
    {
      param: { id: sectionId },
      json: { body: customBody, modelConfigId: modelConfigId || null },
    },
    { init: { signal } },
  );
  if (!res.ok) throw await parseResponseError(res, '校正・推敲');
  return res.json();
}

export async function extractEntities(
  sectionId: string,
  signal?: AbortSignal,
): Promise<ExtractResult> {
  const res = await apiClient.sections[':id'].generate.extract.$post(
    {
      param: { id: sectionId },
    },
    { init: { signal } },
  );
  if (!res.ok) throw await parseResponseError(res, '人物・設定の抽出');
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

export interface InlineAssistChunk {
  text: string;
  variant: number;
}

export async function* inlineAssistSectionContent(
  sectionId: string,
  input: {
    selectedText: string;
    action: 'expand' | 'shorten' | 'emotional' | 'dialogue' | 'paraphrase' | 'custom' | 'template';
    customInstruction?: string;
    customPromptId?: string | null;
    surroundingText?: string;
    modelConfigId?: string | null;
    variantCount?: number;
  },
  signal?: AbortSignal,
): AsyncIterable<InlineAssistChunk> {
  const res = await apiClient.sections[':id'].generate['inline-assist'].$post(
    {
      param: { id: sectionId },
      json: {
        selectedText: input.selectedText,
        action: input.action,
        customInstruction: input.customInstruction,
        customPromptId: input.customPromptId || null,
        surroundingText: input.surroundingText,
        modelConfigId: input.modelConfigId || null,
        variantCount: input.variantCount ?? 1,
      },
    },
    { init: { signal } },
  );

  if (!res.ok) {
    throw await parseResponseError(res, 'AIアシスト生成');
  }
  if (!res.body) {
    throw new Error('レスポンスボディが空です');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;
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
            if (data.text) {
              yield { text: data.text, variant: data.variant ?? 0 };
            }
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

export async function analyzeSettingImpact(
  novelId: string,
  input: {
    changeTarget: 'character' | 'setting';
    targetName: string;
    beforeValue: string;
    afterValue: string;
    modelConfigId?: string | null;
  },
  signal?: AbortSignal,
) {
  const res = await apiClient.novels[':id'].generate.impact.$post(
    {
      param: { id: novelId },
      json: {
        changeTarget: input.changeTarget,
        targetName: input.targetName,
        beforeValue: input.beforeValue,
        afterValue: input.afterValue,
        modelConfigId: input.modelConfigId || null,
      },
    },
    { init: { signal } },
  );
  if (!res.ok) throw await parseResponseError(res, '影響分析');
  return res.json();
}
