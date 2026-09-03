import { useEffect, useState } from "react";

/**
 * 経過秒数の単一 source of truth。
 * ストリーミング系（InlineAIAssistant / StreamingStatus）のタイマー重複を
 * この hook に集約し、二重 setInterval の発生を防ぐ。
 *
 * isLoading または startedAt が falsy になると 0 にリセットする。
 */
export function useElapsedSeconds(
  isLoading: boolean,
  startedAt?: number | null
): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isLoading || !startedAt) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const id = setInterval(() => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      );
    }, 1000);
    return () => clearInterval(id);
  }, [isLoading, startedAt]);

  return elapsedSeconds;
}
