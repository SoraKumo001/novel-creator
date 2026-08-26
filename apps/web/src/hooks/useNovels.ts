import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
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
    queryKey: ['novels'],
    queryFn: () => api.novels.$get().then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateNovelInput) =>
      api.novels.$post({ json: input }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNovelInput }) =>
      api.novels[':id'].$put({ param: { id }, json: input }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.novels[':id'].$delete({ param: { id } }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels'] }),
  });

  return {
    novels,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: refetch as unknown as () => Promise<void>,
    createNovel: createMutation.mutateAsync,
    updateNovel: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteNovel: (id) => deleteMutation.mutateAsync(id).then(() => undefined),
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
