import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
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
    queryKey: ['novels', novelId, 'llmInstructions', entityType],
    queryFn: () =>
      api.novels[':id'].llmInstructions
        .$get({ param: { id: novelId }, query: { entityType } })
        .then((r) => r.json()),
    enabled: !!novelId,
  });

  const saveMutation = useMutation({
    mutationFn: (input: CreateLlmInstructionInput) =>
      api.novels[':id'].llmInstructions
        .$post({ param: { id: novelId }, json: input })
        .then((r) => r.json()),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['novels', novelId, 'llmInstructions', entityType],
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.llmInstructions[':id'].$delete({ param: { id } }).then((r) => r.json()),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['novels', novelId, 'llmInstructions', entityType],
      }),
  });

  return {
    instructions,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: refetch as unknown as () => Promise<void>,
    saveInstruction: saveMutation.mutateAsync,
    deleteInstruction: (id) => deleteMutation.mutateAsync(id).then(() => undefined),
    saving: saveMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
