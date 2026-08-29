import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { novelKeys } from '@/lib/queryKeys.js';
import { importNovelBackup } from '@/lib/services/index.js';
import type { ImportResult } from '@/lib/types.js';

interface UseRestoreNovelReturn {
  restoreNovel: (data: unknown) => Promise<ImportResult>;
  restoring: boolean;
  error: string | null;
}

export function useRestoreNovel(): UseRestoreNovelReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: unknown) => importNovelBackup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: novelKeys.all });
    },
  });

  return {
    restoreNovel: mutation.mutateAsync,
    restoring: mutation.isPending,
    error: mutation.error ? toErrorMessage(mutation.error) : null,
  };
}
