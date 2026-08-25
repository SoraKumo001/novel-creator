import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { CreateSettingInput, Setting, UpdateSettingInput } from '@/lib/types.js';

interface UseSettingsReturn {
  settings: Setting[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createSetting: (input: CreateSettingInput) => Promise<Setting>;
  updateSetting: (id: string, input: UpdateSettingInput) => Promise<Setting>;
  deleteSetting: (id: string) => Promise<void>;
  llmEditSetting: (id: string, instruction: string) => Promise<Setting>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  llmEditing: boolean;
}

export function useSettings(novelId: string): UseSettingsReturn {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [llmEditing, setLlmEditing] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.novels[':id'].settings.$get({ param: { id: novelId } });
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    if (!novelId) return;
    void fetchSettings();
  }, [novelId, fetchSettings]);

  const createSetting = useCallback(
    async (input: CreateSettingInput) => {
      setCreating(true);
      try {
        const res = await api.novels[':id'].settings.$post({ param: { id: novelId }, json: input });
        const data = await res.json();
        setSettings((prev) => [...prev, data]);
        return data;
      } finally {
        setCreating(false);
      }
    },
    [novelId],
  );

  const updateSetting = useCallback(async (id: string, input: UpdateSettingInput) => {
    setUpdating(true);
    try {
      const res = await api.settings[':id'].$put({ param: { id }, json: input });
      const data = await res.json();
      setSettings((prev) => prev.map((s) => (s.id === id ? data : s)));
      return data;
    } finally {
      setUpdating(false);
    }
  }, []);

  const deleteSetting = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const res = await api.settings[':id'].$delete({ param: { id } });
      await res.json();
      setSettings((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeleting(false);
    }
  }, []);

  const llmEditSetting = useCallback(async (id: string, instruction: string) => {
    setLlmEditing(true);
    try {
      const res = await api.settings[':id'].edit.$post({ param: { id }, json: { instruction } });
      const data = await res.json();
      setSettings((prev) => prev.map((s) => (s.id === id ? data : s)));
      return data;
    } finally {
      setLlmEditing(false);
    }
  }, []);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
    createSetting,
    updateSetting,
    deleteSetting,
    llmEditSetting,
    creating,
    updating,
    deleting,
    llmEditing,
  };
}
