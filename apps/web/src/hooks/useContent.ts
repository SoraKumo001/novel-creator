import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toErrorMessage } from "@/lib/errors.js";
import { sectionKeys } from "@/lib/queryKeys.js";
import { fetchContent, updateContent } from "@/lib/services/index.js";
import type { Content } from "@/lib/types.js";

interface UseContentReturn {
  content: Content | null;
  error: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
  saving: boolean;
  updateContent: (body: string) => Promise<Content>;
}

export function useContent(sectionId: string): UseContentReturn {
  const queryClient = useQueryClient();

  const {
    data: content = null,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: sectionKeys.content(sectionId),
    queryFn: () => fetchContent(sectionId),
    enabled: !!sectionId,
  });

  const updateMutation = useMutation({
    mutationFn: (body: string) => updateContent(sectionId, { body }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: sectionKeys.content(sectionId),
      }),
  });

  return {
    content,
    loading,
    saving: updateMutation.isPending,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    updateContent: updateMutation.mutateAsync,
  };
}
