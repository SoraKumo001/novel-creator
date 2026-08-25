import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { Content, UpdateContentInput } from '@/lib/types.js';

interface UseContentReturn {
  content: Content | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateContent: (body: string) => Promise<Content>;
}

export function useContent(sectionId: string): UseContentReturn {
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.sections[':id'].content.$get({ param: { id: sectionId } });
      const data = await res.json();
      setContent(data);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    if (!sectionId) return;
    void fetchContent();
  }, [sectionId, fetchContent]);

  const updateContent = useCallback(
    async (body: string) => {
      setSaving(true);
      try {
        const res = await api.sections[':id'].content.$put({
          param: { id: sectionId },
          json: { body } satisfies UpdateContentInput,
        });
        const data = await res.json();
        setContent(data);
        return data;
      } finally {
        setSaving(false);
      }
    },
    [sectionId],
  );

  return { content, loading, saving, error, refetch: fetchContent, updateContent };
}
