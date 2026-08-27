import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { createTimeline, deleteTimeline, fetchTimelines } from '@/lib/services/index.js';
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
    queryFn: () => fetchTimelines(novelId),
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTimelineInput) => createTimeline(novelId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'timelines'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTimeline(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'timelines'] }),
  });

  return {
    timelines,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: refetch as unknown as () => Promise<void>,
    createTimeline: createMutation.mutateAsync,
    deleteTimeline: (id) => deleteMutation.mutateAsync(id),
    creating: createMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
