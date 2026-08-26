import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type {
  CreateSettingInput,
  EditSettingSectionResult,
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
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  llmEditing: boolean;
  generatingDraft: boolean;
  savingMarkdown: boolean;
  editingSection: boolean;
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
    queryFn: () =>
      api.novels[':id'].settings.$get({ param: { id: novelId } }).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateSettingInput) =>
      api.novels[':id'].settings
        .$post({ param: { id: novelId }, json: input })
        .then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'settings'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSettingInput }) =>
      api.settings[':id'].$put({ param: { id }, json: input }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'settings'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.settings[':id'].$delete({ param: { id } }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'settings'] }),
  });

  const llmEditMutation = useMutation({
    mutationFn: ({ id, instruction }: { id: string; instruction: string }) =>
      api.settings[':id'].edit
        .$post({ param: { id }, json: { instruction } })
        .then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'settings'] }),
  });

  const draftMutation = useMutation({
    mutationFn: ({
      instruction,
      currentDraft,
    }: {
      instruction: string;
      currentDraft?: { category: string; name: string; description?: string };
    }) =>
      api.novels[':id'].settings.draft
        .$post({ param: { id: novelId }, json: { instruction, currentDraft } })
        .then((r) => r.json()),
  });

  const saveMarkdownMutation = useMutation({
    mutationFn: (markdown: string) =>
      api.novels[':id'].settings.markdown
        .$put({ param: { id: novelId }, json: { markdown } })
        .then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels', novelId, 'settings'] }),
  });

  const editSectionMutation = useMutation({
    mutationFn: (input: {
      category: string;
      name: string;
      description: string;
      instruction: string;
    }) =>
      api.novels[':id'].settings.editSection
        .$post({ param: { id: novelId }, json: input })
        .then(async (r) => {
          const data: EditSettingSectionResult = await r.json();
          return data.markdown;
        }),
  });

  const fetchSettingsMarkdown = useCallback(async (): Promise<string> => {
    const res = await api.novels[':id'].settings.markdown.$get({ param: { id: novelId } });
    const data = await res.json();
    return data.markdown;
  }, [novelId]);

  return {
    settings,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: refetch as unknown as () => Promise<void>,
    createSetting: createMutation.mutateAsync,
    updateSetting: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteSetting: (id: string) => deleteMutation.mutateAsync(id).then(() => undefined),
    llmEditSetting: (id, instruction) => llmEditMutation.mutateAsync({ id, instruction }),
    generateDraft: (instruction, currentDraft) =>
      draftMutation.mutateAsync({ instruction, currentDraft }),
    fetchSettingsMarkdown,
    saveSettingsMarkdown: saveMarkdownMutation.mutateAsync,
    editSettingSection: editSectionMutation.mutateAsync,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    llmEditing: llmEditMutation.isPending,
    generatingDraft: draftMutation.isPending,
    savingMarkdown: saveMarkdownMutation.isPending,
    editingSection: editSectionMutation.isPending,
  };
}
