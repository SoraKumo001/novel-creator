import { useEffect, useState } from 'react';
import { Button } from './Button.js';
import type { AnalysisProgress } from '@/hooks/useAnalysis.js';

interface AnalysisProgressPanelProps {
  progress: AnalysisProgress | null;
  /** 解析開始時刻 (ms epoch)。経過時間の表示に利用する。 */
  startedAt: number;
  /** キャンセルボタン押下時のコールバック (useAnalysis.cancel を呼ぶ想定)。 */
  onCancel: () => void;
}

/**
 * mm:ss 形式にフォーマットする。
 */
function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
  );

  // 経過時間を1秒ごとに更新
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const stage = progress?.stage ?? '';
  const total = progress?.total ?? 0;
  const current = progress?.current ?? 0;
  const isDeterminate = total > 0;
  const percent = isDeterminate ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="space-y-4 py-6">
      {/* ステージラベル */}
      <div className="space-y-1.5 text-center">
        <p className="text-sm font-semibold text-foreground">{stage || '解析を実行しています…'}</p>
        <p className="text-[11px] text-muted-foreground">
          経過時間 {formatElapsed(elapsedSeconds)}
          {isDeterminate ? ` ・ ${current} / ${total}` : ' ・ しばらくお待ちください'}
        </p>
      </div>

      {/* プログレスバー */}
      <div
        className="h-2 w-full overflow-hidden rounded-full border border-border bg-surface-raised"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={isDeterminate ? total : undefined}
        aria-valuenow={isDeterminate ? current : undefined}
        aria-busy={!isDeterminate}
        aria-label={stage || '解析の進捗'}
      >
        {isDeterminate ? (
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <IndeterminateBar />
        )}
      </div>

      {/* キャンセル */}
      <div className="flex justify-center pt-1">
        <Button variant="secondary" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}

function IndeterminateBar() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-y-0 w-1/3 animate-[analysis-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      <style>{`@keyframes analysis-indeterminate { 0% { left: -35%; } 100% { left: 100%; } }`}</style>
    </div>
  );
}
