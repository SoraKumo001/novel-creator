interface GenerateContentPanelProps {
  generatingContent: boolean;
  streamError: string | null;
}

export function GenerateContentPanel({
  generatingContent,
  streamError,
}: GenerateContentPanelProps) {
  return (
    <>
      {generatingContent && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-2 text-xs text-primary bg-surface">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
          本文をストリーミング生成中…
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
