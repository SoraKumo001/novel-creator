import { useEffect, useState } from 'react';
import { formatElapsed } from '@/components/AIProgressIndicator.js';

interface GenerateContentPanelProps {
  generatingContent: boolean;
  streamError: string | null;
  startedAt?: number | null;
  generatedChars?: number;
  onCancel?: () => void;
}

export function GenerateContentPanel({
  generatingContent,
  streamError,
  startedAt,
  generatedChars = 0,
  onCancel,
}: GenerateContentPanelProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!generatingContent || !startedAt) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const id = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [generatingContent, startedAt]);

  return (
    <>
      {generatingContent && (
        <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-2 text-xs bg-primary/5 text-primary">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
            <span className="font-semibold">本文をストリーミング執筆中…</span>
            <span className="text-[11px] text-muted-foreground font-mono">
              ({formatElapsed(elapsedSeconds)})
            </span>
            {generatedChars > 0 && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                +{generatedChars.toLocaleString()} 文字
              </span>
            )}
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 transition cursor-pointer"
            >
              ■ 生成停止
            </button>
          )}
        </div>
      )}
      {streamError && (
        <div className="shrink-0 border-t border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">
          {streamError}
        </div>
      )}
    </>
  );
}
