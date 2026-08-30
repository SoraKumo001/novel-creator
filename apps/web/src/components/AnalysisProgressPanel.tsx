import { AIProgressIndicator } from './AIProgressIndicator.js';
import type { AnalysisProgress } from '@/hooks/useAnalysis.js';

interface AnalysisProgressPanelProps {
  progress: AnalysisProgress | null;
  /** 解析開始時刻 (ms epoch)。経過時間の表示に利用する。 */
  startedAt: number;
  /** キャンセルボタン押下時のコールバック (useAnalysis.cancel を呼ぶ想定)。 */
  onCancel: () => void;
}

/**
 * 解析実行中の進捗パネル。
 * backend から届く stage ラベルをそのまま表示し、
 * total > 0 なら決定バー、total === 0 なら不定バーを表示する。
 */
export function AnalysisProgressPanel({
  progress,
  startedAt,
  onCancel,
}: AnalysisProgressPanelProps) {
  return (
    <AIProgressIndicator
      stage={progress?.stage || '解析を実行しています…'}
      startedAt={startedAt}
      current={progress?.current}
      total={progress?.total}
      onCancel={onCancel}
      cancelLabel="キャンセル"
      variant="panel"
    />
  );
}
