import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { CreateTimelineInput, Timeline } from '@/lib/types.js';

interface UseTimelinesReturn {
  timelines: Timeline[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTimeline: (input: CreateTimelineInput) => Promise<Timeline>;
  deleteTimeline: (id: string) => Promise<void>;
  creating: boolean;
  deleting: boolean;
}

export function useTimelines(novelId: string): UseTimelinesReturn {
  const queryClient = useQueryClient();

  const {
    data: timelines = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['novels', novelId, 'timelines'],
    queryFn: () =>
      api.novels[':id'].timelines.$get({ param: { id: novelId } }).then((r) => r.json()),
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTimelineInput) =>
      api.novels[':id'].timelines
        .$post({ param: { id: novelId }, json: input })
        .then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'timelines'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.timelines[':id'].$delete({ param: { id } }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'timelines'] }),
  });

  return {
    timelines,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: refetch as unknown as () => Promise<void>,
    createTimeline: createMutation.mutateAsync,
    deleteTimeline: (id) => deleteMutation.mutateAsync(id).then(() => undefined),
    creating: createMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
