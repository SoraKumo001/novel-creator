import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { Content, UpdateContentInput } from '@/lib/types.js';

interface UseContentReturn {
  content: Content | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refetch: () => Promise<void>;
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
    queryKey: ['sections', sectionId, 'content'],
    queryFn: () =>
      api.sections[':id'].content.$get({ param: { id: sectionId } }).then((r) => r.json()),
    enabled: !!sectionId,
  });

  const updateMutation = useMutation({
    mutationFn: (body: string) =>
      api.sections[':id'].content
        .$put({ param: { id: sectionId }, json: { body } satisfies UpdateContentInput })
        .then((r) => r.json()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['sections', sectionId, 'content'] }),
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
