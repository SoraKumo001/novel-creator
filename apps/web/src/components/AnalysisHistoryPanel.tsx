import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import { deleteAnalysisResult, listAnalysisResults } from '@/lib/services/analysis.js';
import type { AnalysisHistoryEntry, AnalysisType } from '@/lib/types.js';
import { ConfirmDialog } from './ConfirmDialog.js';

interface AnalysisHistoryPanelProps {
  novelId: string;
  analysisType: AnalysisType;
  /** 親モーダルが開いているか。開いたタイミングで履歴を取得する。 */
  isOpen: boolean;
  /** 新しい解析が完了した等で履歴を再取得したいときにインクリメントする。 */
  refreshKey?: number;
  /** 保存済み結果を選んだときのコールバック。 */
  onSelect: (entry: AnalysisHistoryEntry) => void;
  /** 「再実行」が押されたときのコールバック。 */
  onRerun: () => void;
}

/** 1分ごとに相対時刻表示を更新するためのフック。 */
function useNowMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * ISO日時を「3分前 / 2時間前 / 8月30日 14:05」形式で表示する。
 */
function formatFriendlyTime(iso: string, now: number): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const diffMs = now - time;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24 && diffMs < 24 * 3600000) return `${diffHour}時間前`;
  const d = new Date(time);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/**
 * 保存済み分析結果の履歴パネル。
 * モーダル内の折りたたみ可能な「履歴」セクションとして利用する。
 */
export function AnalysisHistoryPanel({
  novelId,
  analysisType,
  isOpen,
  refreshKey = 0,
  onSelect,
  onRerun,
}: AnalysisHistoryPanelProps) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(true);
  const [entries, setEntries] = useState<AnalysisHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnalysisHistoryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestSeq = useRef(0);
  const now = useNowMinute();

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const list = await listAnalysisResults(novelId, analysisType);
      if (requestSeq.current === seq) {
        setEntries(list);
      }
    } catch (e) {
      // 履歴取得失敗は致命的ではないので静かに扱う
      console.error('分析履歴の取得に失敗しました', e);
      if (requestSeq.current === seq) {
        setEntries([]);
      }
    } finally {
      if (requestSeq.current === seq) {
        setLoading(false);
      }
    }
  }, [novelId, analysisType]);

  // モーダルが開いたとき・新規実行後に履歴を取得
  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load, refreshKey]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAnalysisResult(novelId, deleteTarget.id);
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      toast.error(toErrorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface-raised/60">
      {/* ヘッダー（折りたたみ） */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <span>履歴</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
            {entries.length} 件
          </span>
        </span>
        <span
          className={`text-muted-foreground transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border/60 px-3.5 py-3">
          {/* 再実行 */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">過去の保存済み結果を確認できます。</p>
            <button
              type="button"
              onClick={onRerun}
              className="shrink-0 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              新しく実行
            </button>
          </div>

          {/* 一覧 */}
          {loading ? (
            <p className="py-4 text-center text-xs text-muted-foreground">読み込み中…</p>
          ) : entries.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              保存された分析結果はまだありません
            </p>
          ) : (
            <ul className="space-y-1.5">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <div className="group flex items-center justify-between gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-xs transition hover:border-border hover:bg-surface">
                    <button
                      type="button"
                      onClick={() => onSelect(entry)}
                      className="min-w-0 flex-1 text-left"
                      title="この結果を表示"
                    >
                      <span className="text-foreground-secondary font-semibold">
                        {formatFriendlyTime(entry.createdAt, now)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(entry)}
                      aria-label="この履歴を削除"
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-rose-500/10 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="この分析履歴を削除しますか？"
        message="保存された分析結果が削除されます。この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deleting}
      />
    </div>
  );
}
