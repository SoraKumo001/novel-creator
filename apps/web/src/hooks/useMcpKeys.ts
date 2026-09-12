import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toErrorMessage } from "@/lib/errors.js";
import { mcpKeyKeys } from "@/lib/queryKeys.js";
import {
  type CreateMcpKeyInput,
  type CreateMcpKeyResult,
  createMcpKey,
  fetchMcpKeys,
  type McpKey,
  revokeMcpKey,
} from "@/lib/services/mcpKey.js";

interface UseMcpKeysReturn {
  createKey: (input: CreateMcpKeyInput) => Promise<CreateMcpKeyResult>;
  creating: boolean;
  error: string | null;
  keys: McpKey[];
  loading: boolean;
  refetch: () => Promise<void>;
  revokeKey: (id: string) => Promise<void>;
  revoking: boolean;
}

interface UseMcpKeysOptions {
  novelId?: string;
}

export function useMcpKeys(options?: UseMcpKeysOptions): UseMcpKeysReturn {
  const queryClient = useQueryClient();

  const {
    data: keys = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: options?.novelId
      ? [...mcpKeyKeys.all, { novelId: options.novelId }]
      : mcpKeyKeys.all,
    queryFn: () => fetchMcpKeys(options?.novelId),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateMcpKeyInput) => createMcpKey(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: mcpKeyKeys.all }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeMcpKey(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: mcpKeyKeys.all }),
  });

  return {
    keys,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    createKey: createMutation.mutateAsync,
    revokeKey: (id) => revokeMutation.mutateAsync(id),
    creating: createMutation.isPending,
    revoking: revokeMutation.isPending,
  };
}
