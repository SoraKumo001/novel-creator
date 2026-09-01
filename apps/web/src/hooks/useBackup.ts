import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toErrorMessage } from "@/lib/errors.js";
import { novelKeys } from "@/lib/queryKeys.js";
import { exportNovelBackup } from "@/lib/services/index.js";

interface UseExportNovelReturn {
  error: string | null;
  exporting: boolean;
  exportNovel: (novelId: string) => Promise<Response>;
}

export function useExportNovel(): UseExportNovelReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (novelId: string) => exportNovelBackup(novelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.all }),
  });

  return {
    exportNovel: mutation.mutateAsync,
    exporting: mutation.isPending,
    error: mutation.error ? toErrorMessage(mutation.error) : null,
  };
}
