import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { novelKeys } from '@/lib/queryKeys.js';
import {
  createForeshadowing,
  deleteForeshadowing,
  editForeshadowingDocument,
  editForeshadowingSection,
  fetchForeshadowings,
  getForeshadowingsMarkdown,
  generateForeshadowingDraft,
  saveForeshadowingsMarkdown,
  updateForeshadowing,
} from '@/lib/services/index.js';
import type {
  CreateForeshadowingInput,
  Foreshadowing,
  ForeshadowingStatus,
  UpdateForeshadowingInput,
} from '@/lib/types.js';

interface UseForeshadowingsReturn {
  foreshadowings: Foreshadowing[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createForeshadowing: (input: CreateForeshadowingInput) => Promise<Foreshadowing>;
  updateForeshadowing: (id: string, input: UpdateForeshadowingInput) => Promise<Foreshadowing>;
  deleteForeshadowing: (id: string) => Promise<void>;
  generateDraft: (
    instruction: string,
    currentDraft?: {
      category?: string;
      title: string;
      description?: string;
      status?: ForeshadowingStatus;
    },
  ) => Promise<{
    category: string;
    title: string;
    description: string;
    status: ForeshadowingStatus;
  }>;
  fetchForeshadowingsMarkdown: () => Promise<string>;
  saveForeshadowingsMarkdown: (
    markdown: string,
  ) => Promise<{ created: number; updated: number; deleted: number }>;
  editForeshadowingSection: (input: {
    category: string;
    title: string;
    description: string;
    status?: ForeshadowingStatus;
    instruction: string;
  }) => Promise<string>;
  editForeshadowingDocument: (input: { markdown: string; instruction: string }) => Promise<string>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  generatingDraft: boolean;
  savingMarkdown: boolean;
  editingSection: boolean;
  editingDocument: boolean;
}

export function useForeshadowings(novelId: string): UseForeshadowingsReturn {
  const queryClient = useQueryClient();

  const {
    data: foreshadowings = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: novelKeys.foreshadowings(novelId),
    queryFn: () => fetchForeshadowings(novelId),
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateForeshadowingInput) => createForeshadowing(novelId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.foreshadowings(novelId) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateForeshadowingInput }) =>
      updateForeshadowing(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.foreshadowings(novelId) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteForeshadowing(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: novelKeys.foreshadowings(novelId) }),
  });

  const draftMutation = useMutation({
    mutationFn: ({
      instruction,
      currentDraft,
    }: {
      instruction: string;
      currentDraft?: {
        category?: string;
        title: string;
        description?: string;
        status?: ForeshadowingStatus;
      };
    }) => generateForeshadowingDraft(novelId, instruction, currentDraft),
  });

  const saveMarkdownMutation = useMutation({
    mutationFn: (markdown: string) => saveForeshadowingsMarkdown(novelId, markdown),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: novelKeys.foreshadowings(novelId) });
      queryClient.invalidateQueries({ queryKey: novelKeys.foreshadowingsMarkdown(novelId) });
    },
  });

  const editSectionMutation = useMutation({
    mutationFn: (input: {
      category: string;
      title: string;
      description: string;
      status?: ForeshadowingStatus;
      instruction: string;
    }) => editForeshadowingSection(novelId, input, input.instruction),
  });

  const editDocumentMutation = useMutation({
    mutationFn: ({ markdown, instruction }: { markdown: string; instruction: string }) =>
      editForeshadowingDocument(novelId, instruction, markdown),
  });

  const fetchForeshadowingsMarkdown = useCallback(async () => {
    return getForeshadowingsMarkdown(novelId);
  }, [novelId]);

  return {
    foreshadowings,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    createForeshadowing: createMutation.mutateAsync,
    updateForeshadowing: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteForeshadowing: async (id) => {
      await deleteMutation.mutateAsync(id);
    },
    generateDraft: (instruction, currentDraft) =>
      draftMutation.mutateAsync({ instruction, currentDraft }),
    fetchForeshadowingsMarkdown,
    saveForeshadowingsMarkdown: saveMarkdownMutation.mutateAsync,
    editForeshadowingSection: editSectionMutation.mutateAsync,
    editForeshadowingDocument: editDocumentMutation.mutateAsync,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    generatingDraft: draftMutation.isPending,
    savingMarkdown: saveMarkdownMutation.isPending,
    editingSection: editSectionMutation.isPending,
    editingDocument: editDocumentMutation.isPending,
  };
}
