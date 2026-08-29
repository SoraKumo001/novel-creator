import {
  extractEntities,
  generateSectionContent,
  inlineAssistSectionContent,
} from './services/generate.js';
import type { InlineAssistInput } from './types.js';

export interface SSEExtractResult {
  timelines: { event: string; order: number; timestamp: string | null }[];
  settings: { category: string; name: string; description: string }[];
}

/**
 * 本文生成のストリームを受信する。
 * チャンクごとに onChunk コールバックを呼び出す。
 */
export async function streamGenerateContent(
  sectionId: string,
  onChunk: (text: string) => void,
  modelConfigId?: string | null,
): Promise<void> {
  try {
    for await (const chunk of generateSectionContent(sectionId, modelConfigId)) {
      if (chunk) {
        onChunk(chunk);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate content';
    throw new Error(message, { cause: err });
  }
}

/**
 * インラインAI支援のストリームを受信する。
 */
export async function streamInlineAssist(
  sectionId: string,
  input: InlineAssistInput,
  onChunk: (text: string) => void,
): Promise<void> {
  try {
    for await (const chunk of inlineAssistSectionContent(sectionId, input)) {
      if (chunk) {
        onChunk(chunk);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to inline assist';
    throw new Error(message, { cause: err });
  }
}

/**
 * 本文生成 + 自動整合性更新（content-auto）のストリームを受信する。
 * 本文チャンクは onChunk に渡し、最後の extract イベントの抽出結果を返す。
 */
export async function streamGenerateContentAuto(
  sectionId: string,
  onChunk: (text: string) => void,
  modelConfigId?: string | null,
): Promise<SSEExtractResult> {
  // 1. 本文ストリーミング
  await streamGenerateContent(sectionId, onChunk, modelConfigId);

  // 2. 抽出処理
  const res = await extractEntities(sectionId);
  return {
    timelines: res.timelines.map((t) => ({
      event: t.event,
      order: t.order,
      timestamp: t.timestamp || null,
    })),
    settings: res.settings.map((s) => ({
      category: s.category,
      name: s.name,
      description: s.description ?? '',
    })),
  };
}

/**
 * 日本語／英語混在のテキストのおおよその文字数・単語数を返す。
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const japanese = trimmed.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g);
  if (japanese && japanese.length > 0) {
    return japanese.length;
  }
  return trimmed.split(/\s+/).length;
}
