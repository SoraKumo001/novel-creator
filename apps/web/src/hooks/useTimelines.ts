import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { novelKeys } from '@/lib/queryKeys.js';
import {
  createTimeline,
  deleteTimeline,
  fetchTimelines,
  updateTimeline,
} from '@/lib/services/index.js';
import type { CreateTimelineInput, Timeline, UpdateTimelineInput } from '@/lib/types.js';

interface UseTimelinesReturn {
  timelines: Timeline[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTimeline: (input: CreateTimelineInput) => Promise<Timeline>;
  updateTimeline: (id: string, input: UpdateTimelineInput) => Promise<Timeline>;
  deleteTimeline: (id: string) => Promise<void>;
  creating: boolean;
  updating: boolean;
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
    queryKey: novelKeys.timelines(novelId),
    queryFn: () => fetchTimelines(novelId),
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTimelineInput) => createTimeline(novelId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.timelines(novelId) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTimelineInput }) =>
      updateTimeline(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.timelines(novelId) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTimeline(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.timelines(novelId) }),
  });

  return {
    timelines,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    createTimeline: createMutation.mutateAsync,
    updateTimeline: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteTimeline: (id) => deleteMutation.mutateAsync(id),
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
