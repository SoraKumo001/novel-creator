import { useCallback, useEffect, useState } from 'react';
import {
  createForeshadowing,
  deleteForeshadowing,
  fetchForeshadowings,
  updateForeshadowing,
} from '@/lib/services/index.js';
import type {
  CreateForeshadowingInput,
  Foreshadowing,
  UpdateForeshadowingInput,
} from '@/lib/types.js';

export function useForeshadowings(novelId: string) {
  const [foreshadowings, setForeshadowings] = useState<Foreshadowing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refetch = useCallback(async () => {
    if (!novelId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchForeshadowings(novelId);
      setForeshadowings(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '伏線一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const handleCreate = useCallback(
    async (input: CreateForeshadowingInput) => {
      setCreating(true);
      setError(null);
      try {
        const item = await createForeshadowing(novelId, input);
        setForeshadowings((prev) => [...prev, item]);
        return item;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '伏線の作成に失敗しました';
        setError(msg);
        throw e;
      } finally {
        setCreating(false);
      }
    },
    [novelId],
  );

  const handleUpdate = useCallback(async (id: string, input: UpdateForeshadowingInput) => {
    setUpdating(true);
    setError(null);
    try {
      const item = await updateForeshadowing(id, input);
      setForeshadowings((prev) => prev.map((f) => (f.id === id ? item : f)));
      return item;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '伏線の更新に失敗しました';
      setError(msg);
      throw e;
    } finally {
      setUpdating(false);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      await deleteForeshadowing(id);
      setForeshadowings((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '伏線の削除に失敗しました';
      setError(msg);
      throw e;
    } finally {
      setDeleting(false);
    }
  }, []);

  return {
    foreshadowings,
    loading,
    error,
    refetch,
    createForeshadowing: handleCreate,
    updateForeshadowing: handleUpdate,
    deleteForeshadowing: handleDelete,
    creating,
    updating,
    deleting,
  };
}
