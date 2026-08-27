import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { exportNovelBackup } from '@/lib/services/index.js';

interface UseExportNovelReturn {
  exportNovel: (novelId: string) => Promise<Response>;
  exporting: boolean;
  error: string | null;
}

export function useExportNovel(): UseExportNovelReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (novelId: string) => exportNovelBackup(novelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels'] }),
  });

  return {
    exportNovel: mutation.mutateAsync,
    exporting: mutation.isPending,
    error: mutation.error ? toErrorMessage(mutation.error) : null,
  };
}
