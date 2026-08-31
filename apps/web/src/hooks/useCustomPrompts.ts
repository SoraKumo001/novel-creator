import { useCallback, useEffect, useState } from 'react';
import {
  createCustomPrompt,
  deleteCustomPrompt,
  fetchCustomPrompts,
  seedDefaultCustomPrompts,
  updateCustomPrompt,
} from '@/lib/services/customPrompts.js';
import type {
  CreateCustomPromptInput,
  CustomPrompt,
  UpdateCustomPromptInput,
} from '@/lib/types.js';
import { toErrorMessage } from '@/lib/errors.js';

interface UseCustomPromptsOptions {
  novelId?: string | null;
  category?: 'inline' | 'generation' | 'chat' | 'general';
  autoFetch?: boolean;
}

export function useCustomPrompts(options: UseCustomPromptsOptions = {}) {
  const { novelId, category, autoFetch = true } = options;
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomPrompts(novelId, category);
      setPrompts(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [novelId, category]);

  useEffect(() => {
    if (autoFetch) {
      void loadPrompts();
    }
  }, [autoFetch, loadPrompts]);

  const handleCreate = useCallback(async (input: CreateCustomPromptInput) => {
    setError(null);
    try {
      const created = await createCustomPrompt(input);
      setPrompts((prev) => [...prev, created]);
      return created;
    } catch (err) {
      setError(toErrorMessage(err));
      throw err;
    }
  }, []);

  const handleUpdate = useCallback(async (id: string, input: UpdateCustomPromptInput) => {
    setError(null);
    try {
      const updated = await updateCustomPrompt(id, input);
      setPrompts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (err) {
      setError(toErrorMessage(err));
      throw err;
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setError(null);
    try {
      await deleteCustomPrompt(id);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(toErrorMessage(err));
      throw err;
    }
  }, []);

  const handleSeed = useCallback(async () => {
    setError(null);
    try {
      const seeded = await seedDefaultCustomPrompts();
      setPrompts(seeded);
      return seeded;
    } catch (err) {
      setError(toErrorMessage(err));
      throw err;
    }
  }, []);

  return {
    prompts,
    loading,
    error,
    refresh: loadPrompts,
    createPrompt: handleCreate,
    updatePrompt: handleUpdate,
    deletePrompt: handleDelete,
    seedPresets: handleSeed,
  };
}
