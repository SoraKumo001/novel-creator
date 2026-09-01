import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toErrorMessage } from "@/lib/errors.js";
import { novelKeys } from "@/lib/queryKeys.js";
import {
  deleteNovel,
  fetchNovelDetail,
  updateNovel,
} from "@/lib/services/index.js";
import type { Novel, NovelDetail, UpdateNovelInput } from "@/lib/types.js";

interface UseNovelReturn {
  deleteNovel: (id: string) => Promise<void>;
  deleting: boolean;
  error: string | null;
  loading: boolean;
  novel: NovelDetail | null;
  refetch: () => Promise<void>;
  updateNovel: (id: string, input: UpdateNovelInput) => Promise<Novel>;
  updating: boolean;
}

export function useNovel(novelId: string): UseNovelReturn {
  const queryClient = useQueryClient();

  const {
    data: novel = null,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: novelKeys.detail(novelId),
    queryFn: () => fetchNovelDetail(novelId),
    enabled: !!novelId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNovelInput }) =>
      updateNovel(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: novelKeys.all });
      queryClient.invalidateQueries({ queryKey: novelKeys.detail(novelId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNovel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.all }),
  });

  return {
    novel,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    updateNovel: (id, input) => updateMutation.mutateAsync({ id, input }),
    updating: updateMutation.isPending,
    deleteNovel: (id) => deleteMutation.mutateAsync(id),
    deleting: deleteMutation.isPending,
  };
}
