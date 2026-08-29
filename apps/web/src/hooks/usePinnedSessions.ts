import { useState } from 'react';

const STORAGE_KEY = 'novel-creator:pinned-sessions';

// ピン留めされた相談セッションのIDを管理するフック（localStorage に永続化）
export function usePinnedSessions() {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const isPinned = (id: string) => pinnedIds.has(id);

  return { pinnedIds, togglePin, isPinned };
}
