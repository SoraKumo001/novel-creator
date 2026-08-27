import { useQuery } from '@tanstack/react-query';
import { toErrorMessage } from '@/lib/errors.js';
import { fetchSection } from '@/lib/services/index.js';
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
    queryFn: () => fetchSection(sectionId),
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
