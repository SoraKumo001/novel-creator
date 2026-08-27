import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import {
  createCharacter,
  deleteCharacter,
  editCharacter,
  editCharacterDocument,
  editCharacterSection,
  fetchCharacters,
  fetchCharactersMarkdown,
  saveCharactersMarkdown,
  updateCharacter,
} from '@/lib/services/index.js';
import type {
  Character,
  CreateCharacterInput,
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
  editCharacterDocument: (input: { markdown: string; instruction: string }) => Promise<string>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  llmEditing: boolean;
  savingMarkdown: boolean;
  editingSection: boolean;
  editingDocument: boolean;
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
    queryFn: () => fetchCharacters(novelId),
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateCharacterInput) => createCharacter(novelId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'characters'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCharacterInput }) =>
      updateCharacter(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'characters'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCharacter(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'characters'] }),
  });

  const llmEditMutation = useMutation({
    mutationFn: ({ id, instruction }: { id: string; instruction: string }) =>
      editCharacter(id, { instruction }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'characters'] }),
  });

  const saveMarkdownMutation = useMutation({
    mutationFn: (markdown: string) => saveCharactersMarkdown(novelId, markdown),
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
    }) => editCharacterSection(novelId, input).then((res) => res.markdown),
  });

  const editDocumentMutation = useMutation({
    mutationFn: (input: { markdown: string; instruction: string }) =>
      editCharacterDocument(novelId, input.markdown, input.instruction).then((res) => res.markdown),
  });

  const fetchMarkdown = useCallback(async (): Promise<string> => {
    const data = await fetchCharactersMarkdown(novelId);
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
    fetchCharactersMarkdown: fetchMarkdown,
    saveCharactersMarkdown: saveMarkdownMutation.mutateAsync,
    editCharacterSection: editSectionMutation.mutateAsync,
    editCharacterDocument: editDocumentMutation.mutateAsync,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    llmEditing: llmEditMutation.isPending,
    savingMarkdown: saveMarkdownMutation.isPending,
    editingSection: editSectionMutation.isPending,
    editingDocument: editDocumentMutation.isPending,
  };
}
