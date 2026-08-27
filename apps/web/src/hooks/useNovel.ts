import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { deleteNovel, fetchNovelDetail, updateNovel } from '@/lib/services/index.js';
import type { Novel, NovelDetail, UpdateNovelInput } from '@/lib/types.js';

interface UseNovelReturn {
  novel: NovelDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateNovel: (id: string, input: UpdateNovelInput) => Promise<Novel>;
  updating: boolean;
  deleteNovel: (id: string) => Promise<void>;
  deleting: boolean;
}

export function useNovel(novelId: string): UseNovelReturn {
  const queryClient = useQueryClient();

  const {
    data: novel = null,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['novels', novelId],
    queryFn: () => fetchNovelDetail(novelId),
    enabled: !!novelId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNovelInput }) => updateNovel(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['novels'] });
      queryClient.invalidateQueries({ queryKey: ['novels', novelId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNovel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels'] }),
  });

  return {
    novel,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: refetch as unknown as () => Promise<void>,
    updateNovel: (id, input) => updateMutation.mutateAsync({ id, input }),
    updating: updateMutation.isPending,
    deleteNovel: (id) => deleteMutation.mutateAsync(id),
    deleting: deleteMutation.isPending,
  };
}
