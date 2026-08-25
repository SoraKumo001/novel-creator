import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { CreateNovelInput, Novel, UpdateNovelInput } from '@/lib/types.js';

interface UseNovelsReturn {
  novels: Novel[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createNovel: (input: CreateNovelInput) => Promise<Novel>;
  updateNovel: (id: string, input: UpdateNovelInput) => Promise<Novel>;
  deleteNovel: (id: string) => Promise<void>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
}

export function useNovels(): UseNovelsReturn {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchNovels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.novels.$get();
      const data = await res.json();
      setNovels(data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNovels();
  }, [fetchNovels]);

  const createNovel = useCallback(async (input: CreateNovelInput) => {
    setCreating(true);
    try {
      const res = await api.novels.$post({ json: input });
      const data = await res.json();
      setNovels((prev) => [...prev, data]);
      return data;
    } finally {
      setCreating(false);
    }
  }, []);

  const updateNovel = useCallback(async (id: string, input: UpdateNovelInput) => {
    setUpdating(true);
    try {
      const res = await api.novels[':id'].$put({ param: { id }, json: input });
      const data = await res.json();
      setNovels((prev) => prev.map((n) => (n.id === id ? data : n)));
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
      setNovels((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setDeleting(false);
    }
  }, []);

  return {
    novels,
    loading,
    error,
    refetch: fetchNovels,
    createNovel,
    updateNovel,
    deleteNovel,
    creating,
    updating,
    deleting,
  };
}
