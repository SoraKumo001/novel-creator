import { useCallback, useEffect, useState } from 'react';
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
  const [section, setSection] = useState<SectionWithContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSection = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.sections[':id'].$get({ param: { id: sectionId } });
      const data = await res.json();
      setSection(data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    if (!sectionId) return;
    void fetchSection();
  }, [sectionId, fetchSection]);

  return { section, loading, error, refetch: fetchSection };
}
