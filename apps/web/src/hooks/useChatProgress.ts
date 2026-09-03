import { useCallback, useRef, useState } from "react";
import {
  type StreamingProgress,
  toChatProgress,
} from "./chatStreamingTypes.js";

interface UseChatProgressResult {
  ensureProgressStarted: () => number;
  handleProgressData: (dataPart: { type: string; data: unknown }) => void;
  progress: StreamingProgress | null;
  resetProgress: () => void;
  setProgress: React.Dispatch<React.SetStateAction<StreamingProgress | null>>;
}

/**
 * バックエンドの data-progress パーツ由来の進捗状態を管理する hook。
 * 経過時間の開始時刻は「最初の data-progress 到着」または「status が submitted になった
 * 時点」のどちらか早い方で確定する。進行中のストリームが変わっても開始時刻を維持するため
 * ref で保持し、ストリーム終了時にリセットする。
 *
 * useChatStreaming の単一 source の一部として切り出したもの。
 * SSE イベント名（data-progress）・ペイロード形状は変更しない。
 */
export function useChatProgress(): UseChatProgressResult {
  const [progress, setProgress] = useState<StreamingProgress | null>(null);
  const progressStartedAtRef = useRef<number | null>(null);

  const ensureProgressStarted = useCallback((): number => {
    if (progressStartedAtRef.current === null) {
      progressStartedAtRef.current = Date.now();
    }
    return progressStartedAtRef.current;
  }, []);

  const resetProgress = useCallback(() => {
    progressStartedAtRef.current = null;
    setProgress(null);
  }, []);

  // data-progress パーツ（transient SSE data）を受信して進捗状態を更新する。
  // このコールバックは useChat の onData に渡され、ストリーム中の一時データパーツを観測できる。
  const handleProgressData = useCallback(
    (dataPart: { type: string; data: unknown }) => {
      if (dataPart.type !== "data-progress") {
        return;
      }
      const payload = toChatProgress(dataPart.data);
      if (!payload) {
        return;
      }
      setProgress({
        phase: payload.phase,
        step: payload.step,
        maxSteps: payload.maxSteps,
        startedAt: ensureProgressStarted(),
      });
    },
    [ensureProgressStarted]
  );

  return {
    ensureProgressStarted,
    handleProgressData,
    progress,
    resetProgress,
    setProgress,
  };
}
