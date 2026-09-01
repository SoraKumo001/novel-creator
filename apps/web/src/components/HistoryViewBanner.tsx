interface HistoryViewBannerProps {
  /** 保存済み結果の作成日時 (ISO)。 */
  createdAt?: string;
}

function formatTimestamp(iso?: string): string {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/**
 * 過去に保存された分析結果を閲覧中であることを示すバッジ。
 * 「履歴」ラベル＋保存日時を表示する。
 */
export function HistoryViewBanner({ createdAt }: HistoryViewBannerProps) {
  const ts = formatTimestamp(createdAt);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs">
      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-[10px] text-primary">
        履歴
      </span>
      <span className="text-muted-foreground">
        {ts
          ? `${ts} に保存された結果を表示しています`
          : "過去に保存された結果を表示しています"}
      </span>
    </div>
  );
}
