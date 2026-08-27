import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { fetchHistories, restoreHistory, type HistoryItem } from '@/lib/services/index.js';

interface UseHistoriesOptions {
  novelId: string;
  entityType?: string;
  entityId?: string;
  enabled?: boolean;
}

export function useHistories({
  novelId,
  entityType,
  entityId,
  enabled = true,
}: UseHistoriesOptions) {
  const queryClient = useQueryClient();

  const queryKey = ['histories', novelId, entityType, entityId];

  const {
    data: histories = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery<HistoryItem[]>({
    queryKey,
    queryFn: () => fetchHistories(novelId, { entityType, entityId }),
    enabled: enabled && !!novelId,
  });

  const restoreMutation = useMutation({
    mutationFn: (historyId: string) => restoreHistory(historyId),
    onSuccess: () => {
      // 関連クエリの無効化
      void queryClient.invalidateQueries({ queryKey: ['histories'] });
      void queryClient.invalidateQueries({ queryKey: ['novels'] });
      void queryClient.invalidateQueries({ queryKey: ['contents'] });
      void queryClient.invalidateQueries({ queryKey: ['characters'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return {
    histories,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch,
    restore: restoreMutation.mutateAsync,
    restoring: restoreMutation.isPending,
  };
}
