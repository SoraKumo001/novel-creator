import { useCallback, useEffect, useRef, useState } from "react";

interface UseMarkdownDraftOptions {
  /**
   * 保存済み内容（savedMarkdown）。指定時はドラフトと同一内容の場合に
   * バナー非表示とするため hasDraft が false になる。
   */
  currentContent?: string;
  debounceMs?: number;
  /** Quota 溢れ検出時の通知コールバック（toast 表示用）。 */
  onQuotaExceeded?: () => void;
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
  /** Quota 溢れ等のドラフト保存エラー（なければ null）。UI 側で toast 表示に使う。 */
  draftError: string | null;
  /** Whether a draft exists in localStorage that differs from the current content. */
  hasDraft: boolean;
  /** Save content to localStorage (debounced). */
  saveDraft: (content: string) => void;
}

function isQuotaExceededError(e: unknown): boolean {
  if (e instanceof DOMException) {
    return (
      e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED"
    );
  }
  if (typeof e === "object" && e !== null && "code" in e) {
    return (e as { code?: unknown }).code === 22;
  }
  return false;
}

export function useMarkdownDraft({
  storageKey,
  currentContent,
  debounceMs = 500,
  onQuotaExceeded,
}: UseMarkdownDraftOptions): UseMarkdownDraftReturn {
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quotaExceededRef = useRef(false);
  const onQuotaExceededRef = useRef(onQuotaExceeded);
  onQuotaExceededRef.current = onQuotaExceeded;

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
      // Quota 溢れ後は保存を抑止する（毎回例外を投げない）。
      if (quotaExceededRef.current) {
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, content);
        } catch (e) {
          // Quota 溢れの握り潰しをやめ、エラー返却＋保存抑止する。
          if (isQuotaExceededError(e)) {
            quotaExceededRef.current = true;
            setDraftError(
              "ドラフトの自動保存に失敗しました（ブラウザの保存容量が不足しています）"
            );
            onQuotaExceededRef.current?.();
          }
          // Quota 以外（私用モードの SecurityError 等）は従来通り無視する。
        }
      }, debounceMs);
    },
    [storageKey, debounceMs]
  );

  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    quotaExceededRef.current = false;
    setDraftError(null);
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
    hasDraft:
      draftContent !== null &&
      (currentContent === undefined || draftContent !== currentContent),
    draftContent,
    draftError,
    saveDraft,
    clearDraft,
    dismissDraft,
    checkDraft,
  };
}
