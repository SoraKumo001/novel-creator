import { useState } from "react";
import { toErrorMessage } from "@/lib/errors.js";
import { useToast } from "./useToast.js";

/**
 * ドメインModal共通のエラー処理。
 * - setErrorFrom: ローカルerror state表示用。Errorならmessage、
 *   それ以外はfallback（従来のinline表示と同義）。
 * - notifyError: トースト通知用。err省略時は固定文言をそのまま通知し、
 *   err指定時はtoErrorMessageで抽出する。
 */
export function useModalError() {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  function setErrorFrom(err: unknown, fallback: string): void {
    setError(err instanceof Error ? err.message : fallback);
  }

  function notifyError(fallback: string, err?: unknown): void {
    if (err === undefined) {
      toast.error(fallback);
    } else {
      toast.error(toErrorMessage(err));
    }
  }

  function clearError(): void {
    setError(null);
  }

  return { error, setError, clearError, setErrorFrom, notifyError };
}
