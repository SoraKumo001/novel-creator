import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { ImportResult } from '@/lib/types.js';

interface UseRestoreNovelReturn {
  restoreNovel: (data: unknown) => Promise<ImportResult>;
  restoring: boolean;
  error: string | null;
}

export function useRestoreNovel(): UseRestoreNovelReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: unknown) => api.backup.$import(data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['novels'] });
    },
  });

  return {
    restoreNovel: mutation.mutateAsync,
    restoring: mutation.isPending,
    error: mutation.error ? toErrorMessage(mutation.error) : null,
  };
}
