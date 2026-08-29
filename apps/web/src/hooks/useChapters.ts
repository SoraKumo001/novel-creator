import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { novelKeys } from '@/lib/queryKeys.js';
import {
  createChapter,
  createSection,
  deleteChapter,
  deleteSection,
  fetchChapters,
  updateChapter,
  updateSection,
} from '@/lib/services/index.js';
import type {
  Chapter,
  ChapterWithSections,
  CreateChapterInput,
  CreateSectionInput,
  Section,
  UpdateChapterInput,
  UpdateSectionInput,
} from '@/lib/types.js';

interface UseChaptersReturn {
  chapters: ChapterWithSections[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createChapter: (input: CreateChapterInput) => Promise<Chapter>;
  updateChapter: (id: string, input: UpdateChapterInput) => Promise<Chapter>;
  deleteChapter: (id: string) => Promise<void>;
  createSection: (chapterId: string, input: CreateSectionInput) => Promise<Section>;
  updateSection: (id: string, input: UpdateSectionInput) => Promise<Section>;
  deleteSection: (id: string) => Promise<void>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateChapterInput }) =>
      updateChapter(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChapter(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const createSectionMutation = useMutation({
    mutationFn: ({ chapterId, input }: { chapterId: string; input: CreateSectionInput }) =>
      createSection(chapterId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSectionInput }) =>
      updateSection(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => deleteSection(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.chapters(novelId) }),
  });

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
    createSection: (chapterId, input) => createSectionMutation.mutateAsync({ chapterId, input }),
    updateSection: (id, input) => updateSectionMutation.mutateAsync({ id, input }),
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
  };
}
