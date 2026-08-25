import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { Novel, NovelDetail, UpdateNovelInput } from '@/lib/types.js';

interface UseNovelReturn {
  novel: NovelDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateNovel: (id: string, input: UpdateNovelInput) => Promise<Novel>;
  updating: boolean;
  deleteNovel: (id: string) => Promise<void>;
  deleting: boolean;
}

export function useNovel(novelId: string): UseNovelReturn {
  const [novel, setNovel] = useState<NovelDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchNovel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.novels[':id'].$get({ param: { id: novelId } });
      const data = await res.json();
      setNovel(data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    if (!novelId) return;
    void fetchNovel();
  }, [novelId, fetchNovel]);

  const updateNovel = useCallback(async (id: string, input: UpdateNovelInput) => {
    setUpdating(true);
    try {
      const res = await api.novels[':id'].$put({ param: { id }, json: input });
      const data = await res.json();
      setNovel((prev) => (prev && prev.id === id ? { ...prev, ...data } : prev));
      return data;
    } finally {
      setUpdating(false);
    }
  }, []);

  const deleteNovel = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const res = await api.novels[':id'].$delete({ param: { id } });
      await res.json();
      setNovel(null);
    } finally {
      setDeleting(false);
    }
  }, []);

  return {
    novel,
    loading,
    error,
    refetch: fetchNovel,
    updateNovel,
    updating,
    deleteNovel,
    deleting,
  };
}
