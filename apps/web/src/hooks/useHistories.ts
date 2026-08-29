import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { historyKeys, novelKeys, sectionKeys } from '@/lib/queryKeys.js';
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

  const queryKey = historyKeys.list(novelId, entityType, entityId);

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
      // 小説配下の全クエリ（chapters/characters/settings/timelines/foreshadowings/llmInstructions）を
      // プレフィックス一致で一括無効化する
      void queryClient.invalidateQueries({ queryKey: novelKeys.detail(novelId) });
      // 本文（section content）は sections プレフィックス配下のため個別に無効化する
      void queryClient.invalidateQueries({ queryKey: sectionKeys.all });
      // 履歴自体も変更されるため無効化する
      void queryClient.invalidateQueries({ queryKey: historyKeys.all });
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
