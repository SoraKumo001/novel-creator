import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { novelKeys } from '@/lib/queryKeys.js';
import {
  createLlmInstruction,
  deleteLlmInstruction,
  fetchLlmInstructions,
} from '@/lib/services/index.js';
import type { CreateLlmInstructionInput, LlmInstruction } from '@/lib/types.js';

interface UseLlmInstructionsReturn {
  instructions: LlmInstruction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  saveInstruction: (input: CreateLlmInstructionInput) => Promise<LlmInstruction>;
  deleteInstruction: (id: string) => Promise<void>;
  saving: boolean;
  deleting: boolean;
}

export function useLlmInstructions(
  novelId: string,
  entityType: string = 'setting',
): UseLlmInstructionsReturn {
  const queryClient = useQueryClient();

  const {
    data: instructions = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: novelKeys.llmInstructions(novelId, entityType),
    queryFn: () => fetchLlmInstructions(novelId, entityType),
    enabled: !!novelId,
  });

  const saveMutation = useMutation({
    mutationFn: (input: CreateLlmInstructionInput) => createLlmInstruction(novelId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: novelKeys.llmInstructions(novelId, entityType),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLlmInstruction(id),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: novelKeys.llmInstructions(novelId, entityType),
      }),
  });

  return {
    instructions,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
    saveInstruction: saveMutation.mutateAsync,
    deleteInstruction: (id) => deleteMutation.mutateAsync(id),
    saving: saveMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
