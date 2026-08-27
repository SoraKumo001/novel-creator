import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import {
  createSetting,
  deleteSetting,
  editSetting,
  editSettingDocument,
  editSettingSection,
  fetchSettings,
  fetchSettingsMarkdown,
  generateSettingDraft,
  saveSettingsMarkdown,
  updateSetting,
} from '@/lib/services/index.js';
import type {
  CreateSettingInput,
  SaveSettingsMarkdownResult,
  Setting,
  SettingDraft,
  UpdateSettingInput,
} from '@/lib/types.js';

interface UseSettingsReturn {
  settings: Setting[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createSetting: (input: CreateSettingInput) => Promise<Setting>;
  updateSetting: (id: string, input: UpdateSettingInput) => Promise<Setting>;
  deleteSetting: (id: string) => Promise<void>;
  llmEditSetting: (id: string, instruction: string) => Promise<Setting>;
  generateDraft: (
    instruction: string,
    currentDraft?: { category: string; name: string; description?: string },
  ) => Promise<SettingDraft>;
  fetchSettingsMarkdown: () => Promise<string>;
  saveSettingsMarkdown: (markdown: string) => Promise<SaveSettingsMarkdownResult>;
  editSettingSection: (input: {
    category: string;
    name: string;
    description: string;
    instruction: string;
  }) => Promise<string>;
  editSettingDocument: (input: { markdown: string; instruction: string }) => Promise<string>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  llmEditing: boolean;
  generatingDraft: boolean;
  savingMarkdown: boolean;
  editingSection: boolean;
  editingDocument: boolean;
}

export function useSettings(novelId: string): UseSettingsReturn {
  const queryClient = useQueryClient();

  const {
    data: settings = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['novels', novelId, 'settings'],
    queryFn: () => fetchSettings(novelId),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateSettingInput) => createSetting(novelId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'settings'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSettingInput }) =>
      updateSetting(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'settings'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSetting(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'settings'] }),
  });

  const llmEditMutation = useMutation({
    mutationFn: ({ id, instruction }: { id: string; instruction: string }) =>
      editSetting(id, { instruction }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'settings'] }),
  });

  const draftMutation = useMutation({
    mutationFn: ({
      instruction,
      currentDraft,
    }: {
      instruction: string;
      currentDraft?: { category: string; name: string; description?: string };
    }) => generateSettingDraft(novelId, { instruction, currentDraft }),
  });

  const saveMarkdownMutation = useMutation({
    mutationFn: (markdown: string) => saveSettingsMarkdown(novelId, markdown),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'settings'] }),
  });

  const editSectionMutation = useMutation({
    mutationFn: (input: {
      category: string;
      name: string;
      description: string;
      instruction: string;
    }) => editSettingSection(novelId, input).then((res) => res.markdown),
  });

  const editDocumentMutation = useMutation({
    mutationFn: (input: { markdown: string; instruction: string }) =>
      editSettingDocument(novelId, input.markdown, input.instruction).then((res) => res.markdown),
  });

  const fetchMarkdown = useCallback(async (): Promise<string> => {
    const data = await fetchSettingsMarkdown(novelId);
    return data.markdown;
  }, [novelId]);

  return {
    settings,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: refetch as unknown as () => Promise<void>,
    createSetting: createMutation.mutateAsync,
    updateSetting: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteSetting: (id: string) => deleteMutation.mutateAsync(id),
    llmEditSetting: (id, instruction) => llmEditMutation.mutateAsync({ id, instruction }),
    generateDraft: (instruction, currentDraft) =>
      draftMutation.mutateAsync({ instruction, currentDraft }),
    fetchSettingsMarkdown: fetchMarkdown,
    saveSettingsMarkdown: saveMarkdownMutation.mutateAsync,
    editSettingSection: editSectionMutation.mutateAsync,
    editSettingDocument: editDocumentMutation.mutateAsync,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    llmEditing: llmEditMutation.isPending,
    generatingDraft: draftMutation.isPending,
    savingMarkdown: saveMarkdownMutation.isPending,
    editingSection: editSectionMutation.isPending,
    editingDocument: editDocumentMutation.isPending,
  };
}
