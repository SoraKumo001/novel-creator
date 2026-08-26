import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type {
  Character,
  CreateCharacterInput,
  EditCharacterSectionResult,
  SaveCharactersMarkdownResult,
  UpdateCharacterInput,
} from '@/lib/types.js';

interface UseCharactersReturn {
  characters: Character[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCharacter: (input: CreateCharacterInput) => Promise<Character>;
  updateCharacter: (id: string, input: UpdateCharacterInput) => Promise<Character>;
  deleteCharacter: (id: string) => Promise<void>;
  llmEditCharacter: (id: string, instruction: string) => Promise<Character>;
  fetchCharactersMarkdown: () => Promise<string>;
  saveCharactersMarkdown: (markdown: string) => Promise<SaveCharactersMarkdownResult>;
  editCharacterSection: (input: {
    category: string;
    name: string;
    description: string;
    traits: string[];
    relationships: string;
    instruction: string;
  }) => Promise<string>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  llmEditing: boolean;
  savingMarkdown: boolean;
  editingSection: boolean;
}

export function useCharacters(novelId: string): UseCharactersReturn {
  const queryClient = useQueryClient();

  const {
    data: characters = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['novels', novelId, 'characters'],
    queryFn: () =>
      api.novels[':id'].characters.$get({ param: { id: novelId } }).then((r) => r.json()),
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateCharacterInput) =>
      api.novels[':id'].characters
        .$post({ param: { id: novelId }, json: input })
        .then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'characters'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCharacterInput }) =>
      api.characters[':id'].$put({ param: { id }, json: input }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'characters'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.characters[':id'].$delete({ param: { id } }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'characters'] }),
  });

  const llmEditMutation = useMutation({
    mutationFn: ({ id, instruction }: { id: string; instruction: string }) =>
      api.characters[':id'].edit
        .$post({ param: { id }, json: { instruction } })
        .then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'characters'] }),
  });

  const saveMarkdownMutation = useMutation({
    mutationFn: (markdown: string) =>
      api.novels[':id'].characters.markdown
        .$put({ param: { id: novelId }, json: { markdown } })
        .then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'characters'] }),
  });

  const editSectionMutation = useMutation({
    mutationFn: (input: {
      category: string;
      name: string;
      description: string;
      traits: string[];
      relationships: string;
      instruction: string;
    }) =>
      api.novels[':id'].characters.editSection
        .$post({ param: { id: novelId }, json: input })
        .then(async (r) => {
          const data: EditCharacterSectionResult = await r.json();
          return data.markdown;
        }),
  });

  const fetchCharactersMarkdown = useCallback(async (): Promise<string> => {
    const res = await api.novels[':id'].characters.markdown.$get({ param: { id: novelId } });
    const data = await res.json();
    return data.markdown;
  }, [novelId]);

  return {
    characters,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    createCharacter: createMutation.mutateAsync,
    updateCharacter: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteCharacter: async (id) => {
      await deleteMutation.mutateAsync(id);
    },
    llmEditCharacter: (id, instruction) => llmEditMutation.mutateAsync({ id, instruction }),
    fetchCharactersMarkdown,
    saveCharactersMarkdown: saveMarkdownMutation.mutateAsync,
    editCharacterSection: editSectionMutation.mutateAsync,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    llmEditing: llmEditMutation.isPending,
    savingMarkdown: saveMarkdownMutation.isPending,
    editingSection: editSectionMutation.isPending,
  };
}
