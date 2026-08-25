import { useCallback, useState } from 'react';
import { api } from '@/lib/api.js';
import type { Character, Setting } from '@/lib/types.js';

interface UseLLMEditReturn {
  editingCharacter: boolean;
  editingSetting: boolean;
  editCharacter: (id: string, instruction: string) => Promise<Character>;
  editSetting: (id: string, instruction: string) => Promise<Setting>;
}

export function useLLMEdit(): UseLLMEditReturn {
  const [editingCharacter, setEditingCharacter] = useState(false);
  const [editingSetting, setEditingSetting] = useState(false);

  const editCharacter = useCallback(async (id: string, instruction: string) => {
    setEditingCharacter(true);
    try {
      const res = await api.characters[':id'].edit.$post({ param: { id }, json: { instruction } });
      return await res.json();
    } finally {
      setEditingCharacter(false);
    }
  }, []);

  const editSetting = useCallback(async (id: string, instruction: string) => {
    setEditingSetting(true);
    try {
      const res = await api.settings[':id'].edit.$post({ param: { id }, json: { instruction } });
      return await res.json();
    } finally {
      setEditingSetting(false);
    }
  }, []);

  return { editingCharacter, editingSetting, editCharacter, editSetting };
}
