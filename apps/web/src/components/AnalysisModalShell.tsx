import type { ReactNode } from "react";
import { useRef } from "react";
import type { AnalysisProgress } from "@/hooks/useAnalysis.js";
import type { AnalysisHistoryEntry } from "@/lib/types.js";
import { AnalysisHistoryPanel } from "./AnalysisHistoryPanel.js";
import { AnalysisProgressPanel } from "./AnalysisProgressPanel.js";
import { Button } from "./Button.js";
import { HistoryViewBanner } from "./HistoryViewBanner.js";
import { Modal } from "./Modal.js";
import { ModalFooter } from "./ModalFooter.js";

export interface AnalysisModalShellProps {
  analysisType: "check-voice" | "persona-review" | "story-arc";
  children: ReactNode;
  error?: string | null;
  historyRefreshKey?: number;
  isOpen: boolean;
  note: string;
  novelId: string;
  onCancel: () => void;
  onClose: () => void;
  onRerun: () => void;
  onSelectHistory: (entry: AnalysisHistoryEntry) => void;
  progress: AnalysisProgress | null;
  running: boolean;
  runningTitle: string;
  showHistoryBanner: boolean;
  title: string;
  viewedAt?: string | null;
}

/**
 * 分析系Modal共通シェル（Modal直ラッパ）。
 * running時: 進捗パネル＋キャンセルのみ。完了時: エラーbanner＋再試行、
 * 履歴banner、結果（children）、履歴パネル＋注記付きフッター。
 */
export function AnalysisModalShell({
  analysisType,
  children,
  error,
  historyRefreshKey = 0,
  isOpen,
  note,
  novelId,
  onCancel,
  onClose,
  onRerun,
  onSelectHistory,
  progress,
  running,
  runningTitle,
  showHistoryBanner,
  title,
  viewedAt = null,
}: AnalysisModalShellProps) {
  // 解析開始時刻。runningに遷移したタイミングで記録する。
  const startTimeRef = useRef<number>(Date.now());
  const wasRunningRef = useRef(false);
  if (running && !wasRunningRef.current) {
    startTimeRef.current = Date.now();
  }
  wasRunningRef.current = running;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={running ? runningTitle : title}
      size="xl"
      footer={
        running ? (
          <ModalFooter
            bordered={false}
            size="md"
            secondary={{ label: "キャンセル", onClick: onCancel }}
          />
        ) : (
          <ModalFooter
            bordered={false}
            align="between"
            size="md"
            leading={
              <span className="text-[11px] text-muted-foreground">{note}</span>
            }
            secondary={{ label: "閉じる", onClick: onClose }}
          />
        )
      }
    >
      {running ? (
        <AnalysisProgressPanel
          progress={progress}
          startedAt={startTimeRef.current}
          onCancel={onCancel}
        />
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-danger-border bg-danger-subtle px-4 py-3 text-danger-subtle-fg text-sm">
              <span>{error}</span>
              <Button size="sm" variant="secondary" onClick={onRerun}>
                再試行
              </Button>
            </div>
          )}

          {showHistoryBanner && (
            <HistoryViewBanner createdAt={viewedAt ?? undefined} />
          )}

          {children}

          <AnalysisHistoryPanel
            novelId={novelId}
            analysisType={analysisType}
            isOpen={isOpen}
            refreshKey={historyRefreshKey}
            onSelect={onSelectHistory}
            onRerun={onRerun}
          />
        </div>
      )}
    </Modal>
  );
}
