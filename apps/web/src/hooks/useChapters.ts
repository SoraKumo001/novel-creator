import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api.js';
import { toErrorMessage } from '@/lib/errors.js';
import type {
  Chapter,
  ChapterWithSections,
  CreateChapterInput,
  CreateSectionInput,
  Section,
  UpdateChapterInput,
  UpdateSectionInput,
} from '@/lib/types.js';

interface UseChaptersReturn {
  chapters: ChapterWithSections[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createChapter: (input: CreateChapterInput) => Promise<Chapter>;
  updateChapter: (id: string, input: UpdateChapterInput) => Promise<Chapter>;
  deleteChapter: (id: string) => Promise<void>;
  createSection: (chapterId: string, input: CreateSectionInput) => Promise<Section>;
  updateSection: (id: string, input: UpdateSectionInput) => Promise<Section>;
  deleteSection: (id: string) => Promise<void>;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
}

export function useChapters(novelId: string): UseChaptersReturn {
  const [chapters, setChapters] = useState<ChapterWithSections[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchChapters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.novels[':id'].chapters.$get({ param: { id: novelId } });
      const rows = await res.json();
      const full: ChapterWithSections[] = [];
      for (const c of rows) {
        const detail = await api.chapters[':id'].$get({ param: { id: c.id } });
        const d = await detail.json();
        full.push(d);
      }
      setChapters(full);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    if (!novelId) return;
    void fetchChapters();
  }, [novelId, fetchChapters]);

  const createChapter = useCallback(
    async (input: CreateChapterInput) => {
      setCreating(true);
      try {
        const res = await api.novels[':id'].chapters.$post({ param: { id: novelId }, json: input });
        const data = await res.json();
        setChapters((prev) => [...prev, { ...data, sections: [] }]);
        return data;
      } finally {
        setCreating(false);
      }
    },
    [novelId],
  );

  const updateChapter = useCallback(async (id: string, input: UpdateChapterInput) => {
    setUpdating(true);
    try {
      const res = await api.chapters[':id'].$put({ param: { id }, json: input });
      const data = await res.json();
      setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
      return data;
    } finally {
      setUpdating(false);
    }
  }, []);

  const deleteChapter = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const res = await api.chapters[':id'].$delete({ param: { id } });
      await res.json();
      setChapters((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeleting(false);
    }
  }, []);

  const createSection = useCallback(async (chapterId: string, input: CreateSectionInput) => {
    setUpdating(true);
    try {
      const res = await api.chapters[':id'].$post({ param: { id: chapterId }, json: input });
      const data = await res.json();
      setChapters((prev) =>
        prev.map((c) => (c.id === chapterId ? { ...c, sections: [...c.sections, data] } : c)),
      );
      return data;
    } finally {
      setUpdating(false);
    }
  }, []);

  const updateSection = useCallback(async (id: string, input: UpdateSectionInput) => {
    setUpdating(true);
    try {
      const res = await api.sections[':id'].$put({ param: { id }, json: input });
      const data = await res.json();
      setChapters((prev) =>
        prev.map((c) => ({
          ...c,
          sections: c.sections.map((s) => (s.id === id ? data : s)),
        })),
      );
      return data;
    } finally {
      setUpdating(false);
    }
  }, []);

  const deleteSection = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      const res = await api.sections[':id'].$delete({ param: { id } });
      await res.json();
      setChapters((prev) =>
        prev.map((c) => ({
          ...c,
          sections: c.sections.filter((s) => s.id !== id),
        })),
      );
    } finally {
      setDeleting(false);
    }
  }, []);

  return {
    chapters,
    loading,
    error,
    refetch: fetchChapters,
    createChapter,
    updateChapter,
    deleteChapter,
    createSection,
    updateSection,
    deleteSection,
    creating,
    updating,
    deleting,
  };
}
