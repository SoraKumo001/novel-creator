import { useCallback, useEffect, useRef, useState } from "react";

interface UseMarkdownDraftOptions {
  debounceMs?: number;
  storageKey: string;
}

interface UseMarkdownDraftReturn {
  /** Check if there's a draft in localStorage. Call on mount. */
  checkDraft: () => void;
  /** Clear the draft from localStorage AND reset state. */
  clearDraft: () => void;
  /** Dismiss the draft banner without removing from localStorage. */
  dismissDraft: () => void;
  /** The draft content from localStorage (null if none). */
  draftContent: string | null;
  /** Whether a draft exists in localStorage that differs from the current content. */
  hasDraft: boolean;
  /** Save content to localStorage (debounced). */
  saveDraft: (content: string) => void;
}

export function useMarkdownDraft({
  storageKey,
  debounceMs = 500,
}: UseMarkdownDraftOptions): UseMarkdownDraftReturn {
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setDraftContent(stored);
    } catch {
      setDraftContent(null);
    }
  }, [storageKey]);

  const saveDraft = useCallback(
    (content: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, content);
        } catch {
          // localStorage might be full or unavailable; silently ignore
        }
      }, debounceMs);
    },
    [storageKey, debounceMs]
  );

  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setDraftContent(null);
  }, [storageKey]);

  const dismissDraft = useCallback(() => {
    setDraftContent(null);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  return {
    hasDraft: draftContent !== null,
    draftContent,
    saveDraft,
    clearDraft,
    dismissDraft,
    checkDraft,
  };
}
