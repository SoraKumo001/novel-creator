import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toErrorMessage } from "@/lib/errors.js";
import { novelKeys } from "@/lib/queryKeys.js";
import {
  createChapter,
  createSection,
  deleteChapter,
  deleteSection,
  fetchChapters,
  fetchPlotMarkdown,
  savePlotMarkdown,
  updateChapter,
  updateSection,
} from "@/lib/services/index.js";
import type {
  Chapter,
  ChapterWithSections,
  CreateChapterInput,
  CreateSectionInput,
  Section,
  UpdateChapterInput,
  UpdateSectionInput,
} from "@/lib/types.js";

interface UseChaptersReturn {
  chapters: ChapterWithSections[];
  createChapter: (input: CreateChapterInput) => Promise<Chapter>;
  createSection: (
    chapterId: string,
    input: CreateSectionInput
  ) => Promise<Section>;
  creating: boolean;
  deleteChapter: (id: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  deleting: boolean;
  error: string | null;
  fetchPlotMarkdown: () => Promise<string>;
  loading: boolean;
  refetch: () => Promise<void>;
  savePlotMarkdown: (
    markdown: string
  ) => Promise<{ created: number; deleted: number; updated: number }>;
  savingMarkdown: boolean;
  updateChapter: (id: string, input: UpdateChapterInput) => Promise<Chapter>;
  updateSection: (id: string, input: UpdateSectionInput) => Promise<Section>;
  updating: boolean;
}

export function useChapters(novelId: string): UseChaptersReturn {
  const queryClient = useQueryClient();

  const {
    data: chapters = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: novelKeys.chapters(novelId),
    queryFn: () => fetchChapters(novelId),
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateChapterInput) => createChapter(novelId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateChapterInput }) =>
      updateChapter(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChapter(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const createSectionMutation = useMutation({
    mutationFn: ({
      chapterId,
      input,
    }: {
      chapterId: string;
      input: CreateSectionInput;
    }) => createSection(chapterId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSectionInput }) =>
      updateSection(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => deleteSection(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const saveMarkdownMutation = useMutation({
    mutationFn: (markdown: string) => savePlotMarkdown(novelId, markdown),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const handleFetchMarkdown = useCallback(async () => {
    const res = await fetchPlotMarkdown(novelId);
    return res.markdown;
  }, [novelId]);

  return {
    chapters,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    createChapter: createMutation.mutateAsync,
    updateChapter: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteChapter: async (id) => {
      await deleteMutation.mutateAsync(id);
    },
    createSection: (chapterId, input) =>
      createSectionMutation.mutateAsync({ chapterId, input }),
    updateSection: (id, input) =>
      updateSectionMutation.mutateAsync({ id, input }),
    deleteSection: async (id) => {
      await deleteSectionMutation.mutateAsync(id);
    },
    creating: createMutation.isPending,
    updating:
      updateMutation.isPending ||
      createSectionMutation.isPending ||
      updateSectionMutation.isPending ||
      deleteSectionMutation.isPending,
    deleting: deleteMutation.isPending,
    fetchPlotMarkdown: handleFetchMarkdown,
    savePlotMarkdown: saveMarkdownMutation.mutateAsync,
    savingMarkdown: saveMarkdownMutation.isPending,
  };
}
