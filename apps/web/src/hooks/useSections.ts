import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { SectionWithContent } from '@/lib/types.js';

interface UseSectionReturn {
  section: SectionWithContent | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSection(sectionId: string): UseSectionReturn {
  const {
    data: section = null,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sections', sectionId],
    queryFn: () => api.sections[':id'].$get({ param: { id: sectionId } }).then((r) => r.json()),
    enabled: !!sectionId,
  });

  return {
    section,
    loading,
    error: error ? toErrorMessage(error) : null,
    refetch: async () => {
      await refetch();
    },
  };
}
