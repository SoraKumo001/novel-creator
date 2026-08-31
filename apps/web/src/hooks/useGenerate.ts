import { useCallback, useRef, useState } from 'react';
import { toErrorMessage } from '@/lib/errors.js';
import {
  analyzeSettingImpact,
  extractEntities,
  generateChapterSummary,
  generatePlot,
  generateSectionSummary,
} from '@/lib/services/index.js';
import { streamGenerateContent, streamInlineAssist } from '@/lib/sse.js';
import type {
  ExtractResult,
  GeneratedPlot,
  GeneratedSummary,
  InlineAssistInput,
  SettingImpactResult,
} from '@/lib/types.js';

export type GenerationType =
  'plot' | 'summary' | 'content' | 'inline-assist' | 'impact' | 'extract';

interface UseGenerateReturn {
  generatingPlot: boolean;
  generatingSummary: boolean;
  generatingContent: boolean;
  extracting: boolean;
  inlineAssisting: boolean;
  analyzingImpact: boolean;
  activeGeneration: GenerationType | null;
  startedAt: number | null;
  generatedChars: number;
  generatedPlot: GeneratedPlot | null;
  generatedSummary: GeneratedSummary | null;
  streamError: string | null;
  generatePlot: (
    novelId: string,
    modelConfigId?: string | null,
    signal?: AbortSignal,
  ) => Promise<GeneratedPlot>;
  generateChapterSummary: (chapterId: string, signal?: AbortSignal) => Promise<GeneratedSummary>;
  generateSectionSummary: (sectionId: string, signal?: AbortSignal) => Promise<GeneratedSummary>;
  generateContent: (
    sectionId: string,
    onChunk: (text: string) => void,
    modelConfigId?: string | null,
    signal?: AbortSignal,
  ) => Promise<void>;
  inlineAssist: (
    sectionId: string,
    input: InlineAssistInput,
    onChunk: (text: string, variant: number) => void,
    signal?: AbortSignal,
  ) => Promise<void>;

  analyzeImpact: (
    novelId: string,
    input: {
      changeTarget: 'character' | 'setting';
      targetName: string;
      beforeValue: string;
      afterValue: string;
      modelConfigId?: string | null;
    },
    signal?: AbortSignal,
  ) => Promise<SettingImpactResult>;
  extract: (sectionId: string, signal?: AbortSignal) => Promise<ExtractResult>;
  cancelGeneration: () => void;
  resetGeneratedPlot: () => void;
  resetGeneratedSummary: () => void;
  resetStreamError: () => void;
}

export function useGenerate(): UseGenerateReturn {
  const [generatingPlot, setGeneratingPlot] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [inlineAssisting, setInlineAssisting] = useState(false);
  const [analyzingImpact, setAnalyzingImpact] = useState(false);
  const [activeGeneration, setActiveGeneration] = useState<GenerationType | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [generatedChars, setGeneratedChars] = useState(0);
  const [generatedPlot, setGeneratedPlot] = useState<GeneratedPlot | null>(null);
  const [generatedSummary, setGeneratedSummary] = useState<GeneratedSummary | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const createSignal = useCallback((externalSignal?: AbortSignal): AbortSignal => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }, []);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setActiveGeneration(null);
    setStartedAt(null);
  }, []);

  const handleGeneratePlot = useCallback(
    async (novelId: string, modelConfigId?: string | null, signal?: AbortSignal) => {
      setGeneratingPlot(true);
      setActiveGeneration('plot');
      setStartedAt(Date.now());
      const sig = createSignal(signal);
      try {
        const data = await generatePlot(novelId, modelConfigId, sig);
        setGeneratedPlot(data);
        return data;
      } finally {
        setGeneratingPlot(false);
        setActiveGeneration(null);
        setStartedAt(null);
      }
    },
    [createSignal],
  );

  const handleGenerateChapterSummary = useCallback(
    async (chapterId: string, signal?: AbortSignal) => {
      setGeneratingSummary(true);
      setActiveGeneration('summary');
      setStartedAt(Date.now());
      const sig = createSignal(signal);
      try {
        const data = await generateChapterSummary(chapterId, sig);
        setGeneratedSummary(data);
        return data;
      } finally {
        setGeneratingSummary(false);
        setActiveGeneration(null);
        setStartedAt(null);
      }
    },
    [createSignal],
  );

  const handleGenerateSectionSummary = useCallback(
    async (sectionId: string, signal?: AbortSignal) => {
      setGeneratingSummary(true);
      setActiveGeneration('summary');
      setStartedAt(Date.now());
      const sig = createSignal(signal);
      try {
        const data = await generateSectionSummary(sectionId, sig);
        setGeneratedSummary(data);
        return data;
      } finally {
        setGeneratingSummary(false);
        setActiveGeneration(null);
        setStartedAt(null);
      }
    },
    [createSignal],
  );

  const generateContent = useCallback(
    async (
      sectionId: string,
      onChunk: (text: string) => void,
      modelConfigId?: string | null,
      signal?: AbortSignal,
    ) => {
      setGeneratingContent(true);
      setActiveGeneration('content');
      setStartedAt(Date.now());
      setGeneratedChars(0);
      setStreamError(null);
      const sig = createSignal(signal);

      const countingOnChunk = (text: string) => {
        setGeneratedChars((prev) => prev + text.length);
        onChunk(text);
      };

      try {
        await streamGenerateContent(sectionId, countingOnChunk, modelConfigId, sig);
      } catch (e) {
        if (sig.aborted || (e instanceof Error && e.name === 'AbortError')) {
          return;
        }
        setStreamError(toErrorMessage(e));
        throw e;
      } finally {
        setGeneratingContent(false);
        setActiveGeneration(null);
        setStartedAt(null);
      }
    },
    [createSignal],
  );

  const inlineAssist = useCallback(
    async (
      sectionId: string,
      input: InlineAssistInput,
      onChunk: (text: string, variant: number) => void,
      signal?: AbortSignal,
    ) => {
      setInlineAssisting(true);
      setActiveGeneration('inline-assist');
      setStartedAt(Date.now());
      setGeneratedChars(0);
      setStreamError(null);
      const sig = createSignal(signal);

      const countingOnChunk = (text: string, variant: number) => {
        setGeneratedChars((prev) => prev + text.length);
        onChunk(text, variant);
      };

      try {
        await streamInlineAssist(sectionId, input, countingOnChunk, sig);
      } catch (e) {
        if (sig.aborted || (e instanceof Error && e.name === 'AbortError')) {
          return;
        }
        setStreamError(toErrorMessage(e));
        throw e;
      } finally {
        setInlineAssisting(false);
        setActiveGeneration(null);
        setStartedAt(null);
      }
    },
    [createSignal],
  );

  const analyzeImpact = useCallback(
    async (
      novelId: string,
      input: {
        changeTarget: 'character' | 'setting';
        targetName: string;
        beforeValue: string;
        afterValue: string;
        modelConfigId?: string | null;
      },
      signal?: AbortSignal,
    ) => {
      setAnalyzingImpact(true);
      setActiveGeneration('impact');
      setStartedAt(Date.now());
      const sig = createSignal(signal);
      try {
        return await analyzeSettingImpact(novelId, input, sig);
      } finally {
        setAnalyzingImpact(false);
        setActiveGeneration(null);
        setStartedAt(null);
      }
    },
    [createSignal],
  );

  const extract = useCallback(
    async (sectionId: string, signal?: AbortSignal) => {
      setExtracting(true);
      setActiveGeneration('extract');
      setStartedAt(Date.now());
      const sig = createSignal(signal);
      try {
        return await extractEntities(sectionId, sig);
      } finally {
        setExtracting(false);
        setActiveGeneration(null);
        setStartedAt(null);
      }
    },
    [createSignal],
  );

  return {
    generatingPlot,
    generatingSummary,
    generatingContent,
    extracting,
    inlineAssisting,
    analyzingImpact,
    activeGeneration,
    startedAt,
    generatedChars,
    generatedPlot,
    generatedSummary,
    streamError,
    generatePlot: handleGeneratePlot,
    generateChapterSummary: handleGenerateChapterSummary,
    generateSectionSummary: handleGenerateSectionSummary,
    generateContent,
    inlineAssist,
    analyzeImpact,
    extract,
    cancelGeneration,
    resetGeneratedPlot: () => setGeneratedPlot(null),
    resetGeneratedSummary: () => setGeneratedSummary(null),
    resetStreamError: () => setStreamError(null),
  };
}
