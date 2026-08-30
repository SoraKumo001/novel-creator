import { useEffect, useState } from 'react';
import { Button } from './Button.js';

export interface AIProgressIndicatorProps {
  /** 現在のフェーズや処理内容の説明（例: 「キャラクター・世界観設定を検索中...」） */
  stage?: string | null;
  /** 詳細サブメッセージ（任意） */
  description?: string | null;
  /** 開始時刻 (epoch ms)。経過時間表示に利用 */
  startedAt?: number;
  /** キャンセルボタン押下時のコールバック（指定時のみキャンセルボタンを表示） */
  onCancel?: () => void;
  /** キャンセルボタンのラベル（デフォルト: 「キャンセル」または「停止」） */
  cancelLabel?: string;
  /** 進捗 (0〜100)。省略時は不定型プログレスバー */
  percent?: number | null;
  /** 現在件数（決定型の場合） */
  current?: number;
  /** 総件数（決定型の場合） */
  total?: number;
  /** 表示バリアント: 'panel'（中央配置パネル） | 'inline'（ツールバー/バナー用インライン） | 'compact' */
  variant?: 'panel' | 'inline' | 'compact';
  /** 追加クラス名 */
  className?: string;
}

export function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function AIProgressIndicator({
  stage,
  description,
  startedAt,
  onCancel,
  cancelLabel = 'キャンセル',
  percent: propPercent,
  current,
  total,
  variant = 'panel',
  className = '',
}: AIProgressIndicatorProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0,
  );

  useEffect(() => {
    if (!startedAt) return;
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const id = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const isDeterminate =
    typeof propPercent === 'number' ||
    (typeof total === 'number' && total > 0 && typeof current === 'number');

  const calculatedPercent =
    typeof propPercent === 'number'
      ? Math.min(100, Math.max(0, propPercent))
      : total && total > 0 && typeof current === 'number'
        ? Math.min(100, Math.round((current / total) * 100))
        : 0;

  if (variant === 'inline') {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
          <span className="font-medium truncate">{stage || 'AI処理を実行中...'}</span>
          {startedAt && (
            <span className="shrink-0 text-[11px] text-muted-foreground font-mono">
              ({formatElapsed(elapsedSeconds)})
            </span>
          )}
          {isDeterminate && (
            <span className="shrink-0 text-[11px] font-semibold text-primary">
              {calculatedPercent}%
            </span>
          )}
        </div>
        {onCancel && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onCancel}
            className="shrink-0 text-xs py-1 h-7"
          >
            {cancelLabel}
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 text-xs text-primary ${className}`}>
        <span className="h-2 w-2 shrink-0 animate-ping rounded-full bg-primary" />
        <span className="font-medium">{stage || 'AI処理中...'}</span>
        {startedAt && (
          <span className="text-[11px] text-muted-foreground font-mono">
            {formatElapsed(elapsedSeconds)}
          </span>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] text-destructive hover:underline cursor-pointer ml-1"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    );
  }

  // default: 'panel'
  return (
    <div className={`space-y-4 py-6 ${className}`}>
      <div className="space-y-1.5 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
          <p className="text-sm font-semibold text-foreground">{stage || 'AI処理を実行中…'}</p>
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <p className="text-[11px] text-muted-foreground font-mono">
          {startedAt ? `経過時間 ${formatElapsed(elapsedSeconds)}` : '処理中'}
          {total && total > 0 && typeof current === 'number'
            ? ` ・ ${current} / ${total}`
            : ' ・ しばらくお待ちください'}
        </p>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full border border-border bg-surface-raised"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={isDeterminate ? 100 : undefined}
        aria-valuenow={isDeterminate ? calculatedPercent : undefined}
        aria-busy={!isDeterminate}
        aria-label={stage || 'AI処理の進捗'}
      >
        {isDeterminate ? (
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${calculatedPercent}%` }}
          />
        ) : (
          <IndeterminateBar />
        )}
      </div>

      {onCancel && (
        <div className="flex justify-center pt-1">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

function IndeterminateBar() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-y-0 w-1/3 animate-[ai-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      <style>{`@keyframes ai-indeterminate { 0% { left: -35%; } 100% { left: 100%; } }`}</style>
    </div>
  );
}
