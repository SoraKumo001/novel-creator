import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { embeddingConfigKeys } from '@/lib/queryKeys.js';
import {
  createEmbeddingConfig,
  deleteEmbeddingConfig,
  fetchEmbeddingConfigs,
  setDefaultEmbeddingConfig,
  testEmbeddingConfig,
  updateEmbeddingConfig,
} from '@/lib/services/index.js';
import type {
  CreateEmbeddingConfigInput,
  EmbeddingConfig,
  TestConnectionResult,
  TestEmbeddingConnectionInput,
  UpdateEmbeddingConfigInput,
} from '@/lib/types.js';

interface UseEmbeddingConfigsReturn {
  configs: EmbeddingConfig[];
  defaultConfig: EmbeddingConfig | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createConfig: (input: CreateEmbeddingConfigInput) => Promise<EmbeddingConfig>;
  updateConfig: (id: string, input: UpdateEmbeddingConfigInput) => Promise<EmbeddingConfig>;
  deleteConfig: (id: string) => Promise<void>;
  setDefaultConfig: (id: string) => Promise<EmbeddingConfig>;
  testConnection: (input: TestEmbeddingConnectionInput) => Promise<TestConnectionResult>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  settingDefault: boolean;
  testing: boolean;
}

export function useEmbeddingConfigs(): UseEmbeddingConfigsReturn {
  const queryClient = useQueryClient();

  const {
    data: configs = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: embeddingConfigKeys.all,
    queryFn: () => fetchEmbeddingConfigs(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateEmbeddingConfigInput) => createEmbeddingConfig(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: embeddingConfigKeys.all }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEmbeddingConfigInput }) =>
      updateEmbeddingConfig(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: embeddingConfigKeys.all }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmbeddingConfig(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: embeddingConfigKeys.all }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => setDefaultEmbeddingConfig(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: embeddingConfigKeys.all }),
  });

  const testMutation = useMutation({
    mutationFn: (input: TestEmbeddingConnectionInput) => testEmbeddingConfig(input),
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
