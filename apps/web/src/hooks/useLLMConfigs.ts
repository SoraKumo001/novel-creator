import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { llmConfigKeys } from '@/lib/queryKeys.js';
import {
  createLLMConfig,
  deleteLLMConfig,
  fetchLLMConfigs,
  setDefaultLLMConfig,
  testLLMConfig,
  updateLLMConfig,
} from '@/lib/services/index.js';
import type {
  CreateLLMConfigInput,
  LLMConfig,
  TestConnectionInput,
  TestConnectionResult,
  UpdateLLMConfigInput,
} from '@/lib/types.js';

interface UseLLMConfigsReturn {
  configs: LLMConfig[];
  defaultConfig: LLMConfig | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createConfig: (input: CreateLLMConfigInput) => Promise<LLMConfig>;
  updateConfig: (id: string, input: UpdateLLMConfigInput) => Promise<LLMConfig>;
  deleteConfig: (id: string) => Promise<void>;
  setDefaultConfig: (id: string) => Promise<LLMConfig>;
  testConnection: (input: TestConnectionInput) => Promise<TestConnectionResult>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  settingDefault: boolean;
  testing: boolean;
}

export function useLLMConfigs(): UseLLMConfigsReturn {
  const queryClient = useQueryClient();

  const {
    data: configs = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: llmConfigKeys.all,
    queryFn: () => fetchLLMConfigs(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateLLMConfigInput) => createLLMConfig(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: llmConfigKeys.all }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLLMConfigInput }) =>
      updateLLMConfig(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: llmConfigKeys.all }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLLMConfig(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: llmConfigKeys.all }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => setDefaultLLMConfig(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: llmConfigKeys.all }),
  });

  const testMutation = useMutation({
    mutationFn: (input: TestConnectionInput) => testLLMConfig(input),
  });

  const defaultConfig = configs.find((c) => c.isDefault);

  return {
    configs,
    defaultConfig,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    createConfig: createMutation.mutateAsync,
    updateConfig: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteConfig: (id) => deleteMutation.mutateAsync(id),
    setDefaultConfig: (id) => setDefaultMutation.mutateAsync(id),
    testConnection: testMutation.mutateAsync,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
    settingDefault: setDefaultMutation.isPending,
    testing: testMutation.isPending,
  };
}
