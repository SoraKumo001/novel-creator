import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toErrorMessage } from "@/lib/errors.js";
import { novelKeys } from "@/lib/queryKeys.js";
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
} from "@/lib/services/index.js";
import type {
  CreateSettingInput,
  SaveSettingsMarkdownResult,
  Setting,
  SettingDraft,
  UpdateSettingInput,
} from "@/lib/types.js";

interface UseSettingsReturn {
  createSetting: (input: CreateSettingInput) => Promise<Setting>;
  creating: boolean;
  deleteSetting: (id: string) => Promise<void>;
  deleting: boolean;
  editingDocument: boolean;
  editingSection: boolean;
  editSettingDocument: (input: {
    markdown: string;
    instruction: string;
  }) => Promise<string>;
  editSettingSection: (input: {
    category: string;
    name: string;
    description: string;
    instruction: string;
  }) => Promise<string>;
  error: string | null;
  fetchSettingsMarkdown: () => Promise<string>;
  generateDraft: (
    instruction: string,
    currentDraft?: { category: string; name: string; description?: string }
  ) => Promise<SettingDraft>;
  generatingDraft: boolean;
  llmEditing: boolean;
  llmEditSetting: (id: string, instruction: string) => Promise<Setting>;
  loading: boolean;
  refetch: () => Promise<void>;
  saveSettingsMarkdown: (
    markdown: string
  ) => Promise<SaveSettingsMarkdownResult>;
  savingMarkdown: boolean;
  settings: Setting[];
  updateSetting: (id: string, input: UpdateSettingInput) => Promise<Setting>;
  updating: boolean;
}

export function useSettings(novelId: string): UseSettingsReturn {
  const queryClient = useQueryClient();

  const {
    data: settings = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: novelKeys.settings(novelId),
    queryFn: () => fetchSettings(novelId),
    enabled: !!novelId,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateSettingInput) => createSetting(novelId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.settings(novelId) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSettingInput }) =>
      updateSetting(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.settings(novelId) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSetting(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.settings(novelId) }),
  });

  const llmEditMutation = useMutation({
    mutationFn: ({ id, instruction }: { id: string; instruction: string }) =>
      editSetting(id, { instruction }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: novelKeys.settings(novelId) }),
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
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: novelKeys.settings(novelId),
      });
      void queryClient.invalidateQueries({
        queryKey: novelKeys.settingsMarkdown(novelId),
      });
    },
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
      editSettingDocument(novelId, input.markdown, input.instruction).then(
        (res) => res.markdown
      ),
  });

  const fetchMarkdown = useCallback(
    async (): Promise<string> =>
      queryClient.ensureQueryData({
        queryKey: novelKeys.settingsMarkdown(novelId),
        queryFn: async () => (await fetchSettingsMarkdown(novelId)).markdown,
      }),
    [queryClient, novelId]
  );

  return {
    settings,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    createSetting: createMutation.mutateAsync,
    updateSetting: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteSetting: (id: string) => deleteMutation.mutateAsync(id),
    llmEditSetting: (id, instruction) =>
      llmEditMutation.mutateAsync({ id, instruction }),
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
