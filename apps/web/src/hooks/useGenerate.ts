import { useCallback, useState } from 'react';
import { toErrorMessage } from '@/lib/errors.js';
import {
  extractEntities,
  generateChapterSummary,
  generatePlot,
  generateSectionSummary,
} from '@/lib/services/index.js';
import { streamGenerateContent } from '@/lib/sse.js';
import type { ExtractResult, GeneratedPlot, GeneratedSummary } from '@/lib/types.js';

interface UseGenerateReturn {
  generatingPlot: boolean;
  generatingSummary: boolean;
  generatingContent: boolean;
  extracting: boolean;
  generatedPlot: GeneratedPlot | null;
  generatedSummary: GeneratedSummary | null;
  streamError: string | null;
  generatePlot: (novelId: string) => Promise<GeneratedPlot>;
  generateChapterSummary: (chapterId: string) => Promise<GeneratedSummary>;
  generateSectionSummary: (sectionId: string) => Promise<GeneratedSummary>;
  generateContent: (sectionId: string, onChunk: (text: string) => void) => Promise<void>;
  extract: (sectionId: string) => Promise<ExtractResult>;
  resetGeneratedPlot: () => void;
  resetGeneratedSummary: () => void;
  resetStreamError: () => void;
}

export function useGenerate(): UseGenerateReturn {
  const [generatingPlot, setGeneratingPlot] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatedPlot, setGeneratedPlot] = useState<GeneratedPlot | null>(null);
  const [generatedSummary, setGeneratedSummary] = useState<GeneratedSummary | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const handleGeneratePlot = useCallback(async (novelId: string) => {
    setGeneratingPlot(true);
    try {
      const data = await generatePlot(novelId);
      setGeneratedPlot(data);
      return data;
    } finally {
      setGeneratingPlot(false);
    }
  }, []);

  const handleGenerateChapterSummary = useCallback(async (chapterId: string) => {
    setGeneratingSummary(true);
    try {
      const data = await generateChapterSummary(chapterId);
      setGeneratedSummary(data);
      return data;
    } finally {
      setGeneratingSummary(false);
    }
  }, []);

  const handleGenerateSectionSummary = useCallback(async (sectionId: string) => {
    setGeneratingSummary(true);
    try {
      const data = await generateSectionSummary(sectionId);
      setGeneratedSummary(data);
      return data;
    } finally {
      setGeneratingSummary(false);
    }
  }, []);

  const generateContent = useCallback(
    async (sectionId: string, onChunk: (text: string) => void) => {
      setGeneratingContent(true);
      setStreamError(null);
      try {
        // SSE ストリーミングで本文を生成する。
        // 接続エラー時は一度だけフォールバックとして再試行する。
        try {
          await streamGenerateContent(sectionId, onChunk);
        } catch (e) {
          setStreamError(toErrorMessage(e));
          // フォールバック: 一度だけ再試行
          await streamGenerateContent(sectionId, onChunk);
        }
      } catch (e) {
        setStreamError(toErrorMessage(e));
        throw e;
      } finally {
        setGeneratingContent(false);
      }
    },
    [],
  );

  const extract = useCallback(async (sectionId: string) => {
    setExtracting(true);
    try {
      return await extractEntities(sectionId);
    } finally {
      setExtracting(false);
    }
  }, []);

  return {
    generatingPlot,
    generatingSummary,
    generatingContent,
    extracting,
    generatedPlot,
    generatedSummary,
    streamError,
    generatePlot: handleGeneratePlot,
    generateChapterSummary: handleGenerateChapterSummary,
    generateSectionSummary: handleGenerateSectionSummary,
    generateContent,
    extract,
    resetGeneratedPlot: () => setGeneratedPlot(null),
    resetGeneratedSummary: () => setGeneratedSummary(null),
    resetStreamError: () => setStreamError(null),
  };
}
