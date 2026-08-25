import { useCallback, useEffect, useState } from 'react';
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
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchTimelines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.novels[':id'].timelines.$get({ param: { id: novelId } });
      const data = await res.json();
      setTimelines(data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    if (!novelId) return;
    void fetchTimelines();
  }, [novelId, fetchTimelines]);

  const createTimeline = useCallback(
    async (input: CreateTimelineInput) => {
      setCreating(true);
      try {
        const res = await api.novels[':id'].timelines.$post({
          param: { id: novelId },
          json: input,
        });
        const data = await res.json();
        setTimelines((prev) => [...prev, data].sort((a, b) => a.order - b.order));
        return data;
      } finally {
        setCreating(false);
      }
    },
    [novelId],
  );

  const deleteTimeline = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const res = await api.timelines[':id'].$delete({ param: { id } });
      await res.json();
      setTimelines((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeleting(false);
    }
  }, []);

  return {
    timelines,
    loading,
    error,
    refetch: fetchTimelines,
    createTimeline,
    deleteTimeline,
    creating,
    deleting,
  };
}
