import { useQuery } from "@tanstack/react-query";
import { toErrorMessage } from "@/lib/errors.js";
import { sectionKeys } from "@/lib/queryKeys.js";
import { fetchSection } from "@/lib/services/index.js";
import type { SectionWithContent } from "@/lib/types.js";

interface UseSectionReturn {
  error: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
  section: SectionWithContent | null;
}

export function useSection(sectionId: string): UseSectionReturn {
  const {
    data: section = null,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: sectionKeys.detail(sectionId),
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
