import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import type { Character, Setting } from '@/lib/types.js';

interface UseLLMEditReturn {
  editingCharacter: boolean;
  editingSetting: boolean;
  editCharacter: (id: string, instruction: string) => Promise<Character>;
  editSetting: (id: string, instruction: string) => Promise<Setting>;
}

export function useLLMEdit(): UseLLMEditReturn {
  const editCharacterMutation = useMutation({
    mutationFn: ({ id, instruction }: { id: string; instruction: string }) =>
      api.characters[':id'].edit
        .$post({ param: { id }, json: { instruction } })
        .then((r) => r.json()),
  });

  const editSettingMutation = useMutation({
    mutationFn: ({ id, instruction }: { id: string; instruction: string }) =>
      api.settings[':id'].edit
        .$post({ param: { id }, json: { instruction } })
        .then((r) => r.json()),
  });

  return {
    editingCharacter: editCharacterMutation.isPending,
    editingSetting: editSettingMutation.isPending,
    editCharacter: (id, instruction) => editCharacterMutation.mutateAsync({ id, instruction }),
    editSetting: (id, instruction) => editSettingMutation.mutateAsync({ id, instruction }),
  };
}
