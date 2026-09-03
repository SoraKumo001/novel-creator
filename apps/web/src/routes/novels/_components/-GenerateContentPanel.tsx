import { useEffect, useState } from "react";
import { formatElapsed } from "@/components/AIProgressIndicator.js";
import { formatCharCount } from "@/lib/format.js";

interface GenerateContentPanelProps {
  generatedChars?: number;
  generatingContent: boolean;
  onCancel?: () => void;
  startedAt?: number | null;
  streamError: string | null;
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
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      );
    }, 1000);
    return () => clearInterval(id);
  }, [generatingContent, startedAt]);

  return (
    <>
      {generatingContent && (
        <div className="flex shrink-0 items-center justify-between border-border border-t bg-primary/5 px-5 py-2 text-primary text-xs">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
            <span className="font-semibold">本文をストリーミング執筆中…</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              ({formatElapsed(elapsedSeconds)})
            </span>
            {generatedChars > 0 && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-[11px] text-primary">
                +{formatCharCount(generatedChars)}
              </span>
            )}
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer rounded px-2.5 py-1 font-semibold text-danger text-xs transition hover:bg-danger/10"
            >
              ■ 生成停止
            </button>
          )}
        </div>
      )}
      {streamError && (
        <div className="shrink-0 border-danger/20 border-t bg-danger/10 px-5 py-2 text-danger text-xs">
          {streamError}
        </div>
      )}
    </>
  );
}
