import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toErrorMessage } from "@/lib/errors.js";
import { novelKeys } from "@/lib/queryKeys.js";
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
} from "@/lib/services/index.js";
import type {
  Character,
  CreateCharacterInput,
  SaveCharactersMarkdownResult,
  UpdateCharacterInput,
} from "@/lib/types.js";

interface UseCharactersReturn {
  characters: Character[];
  createCharacter: (input: CreateCharacterInput) => Promise<Character>;
  creating: boolean;
  deleteCharacter: (id: string) => Promise<void>;
  deleting: boolean;
  editCharacterDocument: (input: {
    markdown: string;
    instruction: string;
  }) => Promise<string>;
  editCharacterSection: (input: {
    category: string;
    name: string;
    description: string;
    traits: string[];
    relationships: string;
    instruction: string;
  }) => Promise<string>;
  editingDocument: boolean;
  editingSection: boolean;
  error: string | null;
  fetchCharactersMarkdown: () => Promise<string>;
  llmEditCharacter: (id: string, instruction: string) => Promise<Character>;
  llmEditing: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
  saveCharactersMarkdown: (
    markdown: string
  ) => Promise<SaveCharactersMarkdownResult>;
  savingMarkdown: boolean;
  updateCharacter: (
    id: string,
    input: UpdateCharacterInput
  ) => Promise<Character>;
  updating: boolean;
}

export function useCharacters(novelId: string): UseCharactersReturn {
  const queryClient = useQueryClient();

  const {
    data: characters = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: novelKeys.characters(novelId),
    queryFn: () => fetchCharacters(novelId),
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateCharacterInput) =>
      createCharacter(novelId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: novelKeys.characters(novelId),
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCharacterInput }) =>
      updateCharacter(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: novelKeys.characters(novelId),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCharacter(id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: novelKeys.characters(novelId),
      }),
  });

  const llmEditMutation = useMutation({
    mutationFn: ({ id, instruction }: { id: string; instruction: string }) =>
      editCharacter(id, { instruction }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: novelKeys.characters(novelId),
      }),
  });

  const saveMarkdownMutation = useMutation({
    mutationFn: (markdown: string) => saveCharactersMarkdown(novelId, markdown),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: novelKeys.characters(novelId),
      });
      void queryClient.invalidateQueries({
        queryKey: novelKeys.charactersMarkdown(novelId),
      });
    },
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
      editCharacterDocument(novelId, input.markdown, input.instruction).then(
        (res) => res.markdown
      ),
  });

  const fetchMarkdown = useCallback(
    async (): Promise<string> =>
      queryClient.ensureQueryData({
        queryKey: novelKeys.charactersMarkdown(novelId),
        queryFn: async () => (await fetchCharactersMarkdown(novelId)).markdown,
      }),
    [queryClient, novelId]
  );

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
    llmEditCharacter: (id, instruction) =>
      llmEditMutation.mutateAsync({ id, instruction }),
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
