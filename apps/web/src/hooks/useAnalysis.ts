import { useCallback, useRef, useState } from "react";
import type { AnalysisRunOptions } from "@/lib/services/analysis.js";
import {
  runPersonaReviewAnalysis,
  runStoryArcAnalysis,
  runVoiceCheckAnalysis,
} from "@/lib/services/analysis.js";
import type {
  AnalysisProgress,
  AnalysisType,
  CharacterVoiceCheckResult,
  MultiPersonaReviewResult,
  StoryArcResult,
} from "@/lib/types.js";

export type { AnalysisProgress };

/**
 * 実行中の分析（story-arc / check-voice / persona-review）を管理するフック。
 * 複数の同時実行を許容し、running / progress は最後に開始した実行を反映する。
 * 最後の実行が終了しても他の実行が残っている場合は、残っている実行のうち
 * 最後に開始されたものに表示をフォールバックする（進捗パネルが消えないようにするため）。
 * 実行結果は resolve 値として返す（履歴への保存はバックエンド側で行われる）。
 */
export function useAnalysis(): {
  /** 現在実行中の分析種別（実行していない場合は null） */
  running: AnalysisType | null;
  /** 現在の進捗（実行していない場合は null）。stage はそのまま表示してよい日本語ラベル */
  progress: AnalysisProgress | null;
  /** ストーリーアーク分析を実行し、結果を返す */
  runStoryArc: (
    novelId: string,
    modelConfigId?: string | null
  ) => Promise<StoryArcResult>;
  /** キャラクター口調チェックを実行し、結果を返す */
  runVoiceCheck: (
    novelId: string,
    opts?: AnalysisRunOptions
  ) => Promise<CharacterVoiceCheckResult>;
  /** ペルソナレビューを実行し、結果を返す */
  runPersonaReview: (
    novelId: string,
    opts?: AnalysisRunOptions
  ) => Promise<MultiPersonaReviewResult>;
  /** 実行中の分析をキャンセルする。対応する Promise は name==='AbortError' の Error で reject される */
  cancel: () => void;
} {
  const [running, setRunning] = useState<AnalysisType | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);

  // 実行中の処理ごとに AbortController を保持する（複数同時実行を許容）。
  // Map は挿入順を保持するため、最後のエントリが「最後に開始した実行」。
  const activeRef = useRef<Map<AbortController, AnalysisType>>(new Map());
  // 実行ごとの最終進捗（フォールバック時に復元するため）
  const lastProgressRef = useRef<Map<AbortController, AnalysisProgress>>(
    new Map()
  );
  const lastControllerRef = useRef<AbortController | null>(null);

  /** abort 由来のエラーかどうか（fetch の DOMException とラップ済み Error の両方を吸収）。 */
  function isAbortError(e: unknown): boolean {
    return e instanceof Error && e.name === "AbortError";
  }

  const run = useCallback(
    async <T>(
      type: AnalysisType,
      invoke: (
        onProgress: (p: AnalysisProgress) => void,
        signal: AbortSignal
      ) => Promise<T>
    ): Promise<T> => {
      const controller = new AbortController();
      activeRef.current.set(controller, type);
      lastControllerRef.current = controller;

      setRunning(type);
      setProgress(null);

      const onProgress = (p: AnalysisProgress) => {
        lastProgressRef.current.set(controller, p);
        // 最後に開始した実行のみ進捗を反映する
        if (lastControllerRef.current === controller) {
          setProgress(p);
        }
      };

      try {
        return await invoke(onProgress, controller.signal);
      } catch (e) {
        if (isAbortError(e)) {
          // キャンセルは UI 上のエラーにしない（呼び出し側で無視される前提）。
          // name だけは 'AbortError' に正規化して再スローする。
          if (e instanceof Error) {
            e.name = "AbortError";
            throw e;
          }
          const wrapped = new Error("分析がキャンセルされました");
          wrapped.name = "AbortError";
          throw wrapped;
        }
        throw e;
      } finally {
        activeRef.current.delete(controller);
        lastProgressRef.current.delete(controller);
        const remaining = [...activeRef.current.entries()];
        const last = remaining[remaining.length - 1];
        // 最後の実行が終わったときのみ状態を更新する（同時実行中の別実行の表示を壊さない）
        if (lastControllerRef.current === controller) {
          lastControllerRef.current = last?.[0] ?? null;
          if (last) {
            // 残りの実行のうち最後に開始されたものにフォールバック
            setRunning(last[1]);
            setProgress(lastProgressRef.current.get(last[0]) ?? null);
          } else {
            setRunning(null);
            setProgress(null);
          }
        }
      }
    },
    []
  );

  const runStoryArc = useCallback(
    (novelId: string, modelConfigId?: string | null) =>
      run("story-arc", (onProgress, signal) =>
        runStoryArcAnalysis(novelId, modelConfigId, onProgress, signal)
      ),
    [run]
  );

  const runVoiceCheck = useCallback(
    (novelId: string, opts?: AnalysisRunOptions) =>
      run("check-voice", (onProgress, signal) =>
        runVoiceCheckAnalysis(novelId, opts, onProgress, signal)
      ),
    [run]
  );

  const runPersonaReview = useCallback(
    (novelId: string, opts?: AnalysisRunOptions) =>
      run("persona-review", (onProgress, signal) =>
        runPersonaReviewAnalysis(novelId, opts, onProgress, signal)
      ),
    [run]
  );

  const cancel = useCallback(() => {
    const controller = lastControllerRef.current;
    if (controller) {
      controller.abort();
    }
  }, []);

  return {
    running,
    progress,
    runStoryArc,
    runVoiceCheck,
    runPersonaReview,
    cancel,
  };
}
