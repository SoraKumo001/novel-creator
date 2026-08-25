import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { Character, CreateCharacterInput, UpdateCharacterInput } from '@/lib/types.js';

interface UseCharactersReturn {
  characters: Character[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCharacter: (input: CreateCharacterInput) => Promise<Character>;
  updateCharacter: (id: string, input: UpdateCharacterInput) => Promise<Character>;
  deleteCharacter: (id: string) => Promise<void>;
  llmEditCharacter: (id: string, instruction: string) => Promise<Character>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  llmEditing: boolean;
}

export function useCharacters(novelId: string): UseCharactersReturn {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [llmEditing, setLlmEditing] = useState(false);

  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.novels[':id'].characters.$get({ param: { id: novelId } });
      const data = await res.json();
      setCharacters(data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    if (!novelId) return;
    void fetchCharacters();
  }, [novelId, fetchCharacters]);

  const createCharacter = useCallback(
    async (input: CreateCharacterInput) => {
      setCreating(true);
      try {
        const res = await api.novels[':id'].characters.$post({
          param: { id: novelId },
          json: input,
        });
        const data = await res.json();
        setCharacters((prev) => [...prev, data]);
        return data;
      } finally {
        setCreating(false);
      }
    },
    [novelId],
  );

  const updateCharacter = useCallback(async (id: string, input: UpdateCharacterInput) => {
    setUpdating(true);
    try {
      const res = await api.characters[':id'].$put({ param: { id }, json: input });
      const data = await res.json();
      setCharacters((prev) => prev.map((c) => (c.id === id ? data : c)));
      return data;
    } finally {
      setUpdating(false);
    }
  }, []);

  const deleteCharacter = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const res = await api.characters[':id'].$delete({ param: { id } });
      await res.json();
      setCharacters((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeleting(false);
    }
  }, []);

  const llmEditCharacter = useCallback(async (id: string, instruction: string) => {
    setLlmEditing(true);
    try {
      const res = await api.characters[':id'].edit.$post({ param: { id }, json: { instruction } });
      const data = await res.json();
      setCharacters((prev) => prev.map((c) => (c.id === id ? data : c)));
      return data;
    } finally {
      setLlmEditing(false);
    }
  }, []);

  return {
    characters,
    loading,
    error,
    refetch: fetchCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    llmEditCharacter,
    creating,
    updating,
    deleting,
    llmEditing,
  };
}
