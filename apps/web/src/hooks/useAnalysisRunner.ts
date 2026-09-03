import { useCallback } from "react";
import { toErrorMessage } from "@/lib/errors.js";
import type { AnalysisHistoryEntry, AnalysisType } from "@/lib/types.js";

interface ModalResultControls<T> {
  close: () => void;
  error: string | null;
  isOpen: boolean;
  open: () => void;
  result: T | null;
  setError: (error: string | null) => void;
  setResult: (result: T | null) => void;
}

interface HistoryViewControls {
  bumpHistoryKey: () => void;
  historyKey: number;
  isHistoryView: boolean;
  resetHistoryView: () => void;
  showHistory: (at: string) => void;
  viewedAt: string | null;
}

interface UseAnalysisRunnerOptions<T> {
  analysisType: AnalysisType;
  history: HistoryViewControls;
  modal: ModalResultControls<T>;
  run: () => Promise<T>;
}

interface UseAnalysisRunnerReturn {
  handleRun: () => Promise<void>;
  handleSelectHistory: (entry: AnalysisHistoryEntry) => void;
}

/**
 * 分析実行（StoryArc / 口調チェック / ペルソナレビュー）の定型を集約するフック。
 * modal（useModalResultState）+ history（useHistoryViewState）+ run* の三連を
 * `{ run, modal, history, analysisType }` の受け渡しで1フックにまとめる。
 * -OverviewTab の handleRun* / handleSelect*History 三連をこのフックで置換できる。
 * 引つきの run* は呼び出し側でクロージャ化する（例: `run: () => runStoryArc(novel.id)`）。
 */
export function useAnalysisRunner<T>({
  run,
  modal,
  history,
  analysisType,
}: UseAnalysisRunnerOptions<T>): UseAnalysisRunnerReturn {
  const handleRun = useCallback(async (): Promise<void> => {
    modal.open();
    modal.setResult(null);
    modal.setError(null);
    history.resetHistoryView();
    try {
      const res = await run();
      modal.setResult(res);
      history.bumpHistoryKey();
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        return;
      }
      modal.setError(toErrorMessage(e));
    }
  }, [run, modal, history]);

  const handleSelectHistory = useCallback(
    (entry: AnalysisHistoryEntry): void => {
      if (entry.analysisType !== analysisType) {
        return;
      }
      modal.setResult(entry.result as T);
      modal.setError(null);
      history.showHistory(entry.createdAt);
    },
    [analysisType, modal, history]
  );

  return { handleRun, handleSelectHistory };
}
