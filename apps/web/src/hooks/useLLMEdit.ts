import { useMutation } from '@tanstack/react-query';
import { editCharacter, editSetting } from '@/lib/services/index.js';
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
      editCharacter(id, { instruction }),
  });

  const editSettingMutation = useMutation({
    mutationFn: ({ id, instruction }: { id: string; instruction: string }) =>
      editSetting(id, { instruction }),
  });

  return {
    editingCharacter: editCharacterMutation.isPending,
    editingSetting: editSettingMutation.isPending,
    editCharacter: (id, instruction) => editCharacterMutation.mutateAsync({ id, instruction }),
    editSetting: (id, instruction) => editSettingMutation.mutateAsync({ id, instruction }),
  };
}
