import { useCallback, useState } from 'react';
import { toErrorMessage } from '@/lib/errors.js';
import {
  analyzeSettingImpact,
  analyzeStoryArc,
  checkCharacterVoice,
  extractEntities,
  generateChapterSummary,
  generatePlot,
  generateSectionSummary,
  multiPersonaReview,
} from '@/lib/services/index.js';
import { streamGenerateContent, streamInlineAssist } from '@/lib/sse.js';
import type {
  CharacterVoiceCheckResult,
  ExtractResult,
  GeneratedPlot,
  GeneratedSummary,
  InlineAssistInput,
  MultiPersonaReviewResult,
  SettingImpactResult,
  StoryArcResult,
} from '@/lib/types.js';

interface UseGenerateReturn {
  generatingPlot: boolean;
  generatingSummary: boolean;
  generatingContent: boolean;
  extracting: boolean;
  inlineAssisting: boolean;
  checkingVoice: boolean;
  analyzingImpact: boolean;
  analyzingArc: boolean;
  reviewingPersona: boolean;
  generatedPlot: GeneratedPlot | null;
  generatedSummary: GeneratedSummary | null;
  streamError: string | null;
  generatePlot: (novelId: string, modelConfigId?: string | null) => Promise<GeneratedPlot>;
  generateChapterSummary: (chapterId: string) => Promise<GeneratedSummary>;
  generateSectionSummary: (sectionId: string) => Promise<GeneratedSummary>;
  generateContent: (
    sectionId: string,
    onChunk: (text: string) => void,
    modelConfigId?: string | null,
  ) => Promise<void>;
  inlineAssist: (
    sectionId: string,
    input: InlineAssistInput,
    onChunk: (text: string) => void,
  ) => Promise<void>;
  checkVoice: (
    novelId: string,
    body?: string,
    modelConfigId?: string | null,
  ) => Promise<CharacterVoiceCheckResult>;
  analyzeImpact: (
    novelId: string,
    input: {
      changeTarget: 'character' | 'setting';
      targetName: string;
      beforeValue: string;
      afterValue: string;
      modelConfigId?: string | null;
    },
  ) => Promise<SettingImpactResult>;
  analyzeArc: (novelId: string, modelConfigId?: string | null) => Promise<StoryArcResult>;
  reviewPersona: (
    novelId: string,
    input: {
      sectionId?: string;
      chapterId?: string;
      body?: string;
      modelConfigId?: string | null;
    },
  ) => Promise<MultiPersonaReviewResult>;
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
  const [inlineAssisting, setInlineAssisting] = useState(false);
  const [checkingVoice, setCheckingVoice] = useState(false);
  const [analyzingImpact, setAnalyzingImpact] = useState(false);
  const [analyzingArc, setAnalyzingArc] = useState(false);
  const [reviewingPersona, setReviewingPersona] = useState(false);
  const [generatedPlot, setGeneratedPlot] = useState<GeneratedPlot | null>(null);
  const [generatedSummary, setGeneratedSummary] = useState<GeneratedSummary | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const handleGeneratePlot = useCallback(async (novelId: string, modelConfigId?: string | null) => {
    setGeneratingPlot(true);
    try {
      const data = await generatePlot(novelId, modelConfigId);
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
    async (sectionId: string, onChunk: (text: string) => void, modelConfigId?: string | null) => {
      setGeneratingContent(true);
      setStreamError(null);
      try {
        try {
          await streamGenerateContent(sectionId, onChunk, modelConfigId);
        } catch (e) {
          setStreamError(toErrorMessage(e));
          await streamGenerateContent(sectionId, onChunk, modelConfigId);
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

  const inlineAssist = useCallback(
    async (sectionId: string, input: InlineAssistInput, onChunk: (text: string) => void) => {
      setInlineAssisting(true);
      setStreamError(null);
      try {
        await streamInlineAssist(sectionId, input, onChunk);
      } catch (e) {
        setStreamError(toErrorMessage(e));
        throw e;
      } finally {
        setInlineAssisting(false);
      }
    },
    [],
  );

  const checkVoice = useCallback(
    async (novelId: string, body?: string, modelConfigId?: string | null) => {
      setCheckingVoice(true);
      try {
        return await checkCharacterVoice(novelId, body, modelConfigId);
      } finally {
        setCheckingVoice(false);
      }
    },
    [],
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
    ) => {
      setAnalyzingImpact(true);
      try {
        return await analyzeSettingImpact(novelId, input);
      } finally {
        setAnalyzingImpact(false);
      }
    },
    [],
  );

  const analyzeArc = useCallback(async (novelId: string, modelConfigId?: string | null) => {
    setAnalyzingArc(true);
    try {
      return await analyzeStoryArc(novelId, modelConfigId);
    } finally {
      setAnalyzingArc(false);
    }
  }, []);

  const reviewPersona = useCallback(
    async (
      novelId: string,
      input: {
        sectionId?: string;
        chapterId?: string;
        body?: string;
        modelConfigId?: string | null;
      },
    ) => {
      setReviewingPersona(true);
      try {
        return await multiPersonaReview(novelId, input);
      } finally {
        setReviewingPersona(false);
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
    inlineAssisting,
    checkingVoice,
    analyzingImpact,
    analyzingArc,
    reviewingPersona,
    generatedPlot,
    generatedSummary,
    streamError,
    generatePlot: handleGeneratePlot,
    generateChapterSummary: handleGenerateChapterSummary,
    generateSectionSummary: handleGenerateSectionSummary,
    generateContent,
    inlineAssist,
    checkVoice,
    analyzeImpact,
    analyzeArc,
    reviewPersona,
    extract,
    resetGeneratedPlot: () => setGeneratedPlot(null),
    resetGeneratedSummary: () => setGeneratedSummary(null),
    resetStreamError: () => setStreamError(null),
  };
}
