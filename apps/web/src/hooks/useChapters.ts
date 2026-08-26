import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
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
    queryKey: ['novels', novelId, 'chapters'],
    queryFn: async () => {
      const res = await api.novels[':id'].chapters.$get({ param: { id: novelId } });
      const rows = await res.json();
      const full: ChapterWithSections[] = [];
      for (const c of rows) {
        const detail = await api.chapters[':id'].$get({ param: { id: c.id } });
        const d = await detail.json();
        full.push(d);
      }
      return full;
    },
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateChapterInput) =>
      api.novels[':id'].chapters
        .$post({ param: { id: novelId }, json: input })
        .then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'chapters'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateChapterInput }) =>
      api.chapters[':id'].$put({ param: { id }, json: input }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'chapters'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.chapters[':id'].$delete({ param: { id } }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'chapters'] }),
  });

  const createSectionMutation = useMutation({
    mutationFn: ({ chapterId, input }: { chapterId: string; input: CreateSectionInput }) =>
      api.chapters[':id'].$post({ param: { id: chapterId }, json: input }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'chapters'] }),
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSectionInput }) =>
      api.sections[':id'].$put({ param: { id }, json: input }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'chapters'] }),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) =>
      api.sections[':id'].$delete({ param: { id } }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'chapters'] }),
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
