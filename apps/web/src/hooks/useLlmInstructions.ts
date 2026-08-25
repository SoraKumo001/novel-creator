import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { CreateLlmInstructionInput, LlmInstruction } from '@/lib/types.js';

interface UseLlmInstructionsReturn {
  instructions: LlmInstruction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  saveInstruction: (input: CreateLlmInstructionInput) => Promise<LlmInstruction>;
  deleteInstruction: (id: string) => Promise<void>;
  saving: boolean;
  deleting: boolean;
}

export function useLlmInstructions(
  novelId: string,
  entityType: string = 'setting',
): UseLlmInstructionsReturn {
  const [instructions, setInstructions] = useState<LlmInstruction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchInstructions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.novels[':id'].llmInstructions.$get({
        param: { id: novelId },
        query: { entityType },
      });
      const data = await res.json();
      setInstructions(data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [novelId, entityType]);

  useEffect(() => {
    if (!novelId) return;
    void fetchInstructions();
  }, [novelId, fetchInstructions]);

  const saveInstruction = useCallback(
    async (input: CreateLlmInstructionInput) => {
      setSaving(true);
      try {
        const res = await api.novels[':id'].llmInstructions.$post({
          param: { id: novelId },
          json: input,
        });
        const data = await res.json();
        // 重複時は既存が返るので、冪等にマージ
        setInstructions((prev) =>
          prev.some((i) => i.id === data.id)
            ? prev.map((i) => (i.id === data.id ? data : i))
            : [data, ...prev],
        );
        return data;
      } finally {
        setSaving(false);
      }
    },
    [novelId],
  );

  const deleteInstruction = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const res = await api.llmInstructions[':id'].$delete({ param: { id } });
      await res.json();
      setInstructions((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setDeleting(false);
    }
  }, []);

  return {
    instructions,
    loading,
    error,
    refetch: fetchInstructions,
    saveInstruction,
    deleteInstruction,
    saving,
    deleting,
  };
}
