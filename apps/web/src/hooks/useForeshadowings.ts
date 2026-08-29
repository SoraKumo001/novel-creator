import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { novelKeys } from '@/lib/queryKeys.js';
import {
  createForeshadowing,
  deleteForeshadowing,
  fetchForeshadowings,
  updateForeshadowing,
} from '@/lib/services/index.js';
import type {
  CreateForeshadowingInput,
  Foreshadowing,
  UpdateForeshadowingInput,
} from '@/lib/types.js';

interface UseForeshadowingsReturn {
  foreshadowings: Foreshadowing[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createForeshadowing: (input: CreateForeshadowingInput) => Promise<Foreshadowing>;
  updateForeshadowing: (id: string, input: UpdateForeshadowingInput) => Promise<Foreshadowing>;
  deleteForeshadowing: (id: string) => Promise<void>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
}

export function useForeshadowings(novelId: string): UseForeshadowingsReturn {
  const queryClient = useQueryClient();

  const {
    data: foreshadowings = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: novelKeys.foreshadowings(novelId),
    queryFn: () => fetchForeshadowings(novelId),
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateForeshadowingInput) => createForeshadowing(novelId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.foreshadowings(novelId) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateForeshadowingInput }) =>
      updateForeshadowing(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.foreshadowings(novelId) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteForeshadowing(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.foreshadowings(novelId) }),
  });

  return {
    foreshadowings,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    createForeshadowing: createMutation.mutateAsync,
    updateForeshadowing: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteForeshadowing: async (id) => {
      await deleteMutation.mutateAsync(id);
    },
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
