import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { novelKeys } from '@/lib/queryKeys.js';
import { createNovel, deleteNovel, fetchNovels, updateNovel } from '@/lib/services/index.js';
import type { CreateNovelInput, Novel, UpdateNovelInput } from '@/lib/types.js';

interface UseNovelsReturn {
  novels: Novel[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createNovel: (input: CreateNovelInput) => Promise<Novel>;
  updateNovel: (id: string, input: UpdateNovelInput) => Promise<Novel>;
  deleteNovel: (id: string) => Promise<void>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
}

export function useNovels(): UseNovelsReturn {
  const queryClient = useQueryClient();

  const {
    data: novels = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: novelKeys.all,
    queryFn: () => fetchNovels(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateNovelInput) => createNovel(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.all }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNovelInput }) => updateNovel(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.all }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNovel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.all }),
  });

  return {
    novels,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    createNovel: createMutation.mutateAsync,
    updateNovel: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteNovel: (id) => deleteMutation.mutateAsync(id),
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
