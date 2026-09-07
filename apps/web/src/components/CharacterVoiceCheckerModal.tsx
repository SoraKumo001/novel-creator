import { MarkdownText } from "@/components/MarkdownText.js";
import type { AnalysisProgress } from "@/hooks/useAnalysis.js";
import type {
  AnalysisHistoryEntry,
  CharacterVoiceCheckResult,
} from "@/lib/types.js";
import { AnalysisModalShell } from "./AnalysisModalShell.js";
import { Badge, type BadgeVariant } from "./Badge.js";
import { Button } from "./Button.js";

interface CharacterVoiceCheckerModalProps {
  error?: string | null;
  historyRefreshKey?: number;
  isHistoryView?: boolean;
  isOpen: boolean;
  novelId: string;
  onApplyFix?: (original: string, suggestion: string) => void;
  onCancel: () => void;
  onClose: () => void;
  onRerun: () => void;
  onSelectHistory: (entry: AnalysisHistoryEntry) => void;
  progress: AnalysisProgress | null;
  result: CharacterVoiceCheckResult | null;
  running: boolean;
  viewedAt?: string | null;
}

const ISSUE_TYPE_LABELS: Record<
  string,
  { label: string; variant: BadgeVariant }
> = {
  firstPerson: {
    label: "一人称の矛盾",
    variant: "rose",
  },
  secondPerson: {
    label: "二人称の矛盾",
    variant: "orange",
  },
  speechPattern: {
    label: "口調・語尾のズレ",
    variant: "amber",
  },
  toneShift: {
    label: "感情・トーン急変",
    variant: "purple",
  },
  outOfCharacter: {
    label: "キャラブレ・不自然",
    variant: "rose",
  },
};

export function CharacterVoiceCheckerModal({
  isOpen,
  onClose,
  result,
  progress,
  running,
  error,
  isHistoryView = false,
  viewedAt = null,
  novelId,
  historyRefreshKey = 0,
  onSelectHistory,
  onRerun,
  onCancel,
  onApplyFix,
}: CharacterVoiceCheckerModalProps) {
  return (
    <AnalysisModalShell
      analysisType="check-voice"
      error={error}
      historyRefreshKey={historyRefreshKey}
      isOpen={isOpen}
      note="分析結果は自動保存されます"
      novelId={novelId}
      onCancel={onCancel}
      onClose={onClose}
      onRerun={onRerun}
      onSelectHistory={onSelectHistory}
      progress={progress}
      running={running}
      runningTitle="キャラクター口調チェック中…"
      showHistoryBanner={isHistoryView && result !== null}
      title="🎭 キャラクター口調・一貫性チェック結果"
      viewedAt={viewedAt}
    >
      {result && <ResultBody result={result} onApplyFix={onApplyFix} />}
    </AnalysisModalShell>
  );
}

function ResultBody({
  result,
  onApplyFix,
}: {
  result: CharacterVoiceCheckResult;
  onApplyFix?: (original: string, suggestion: string) => void;
}) {
  return (
    <>
      {/* 総括ヘッダー */}
      <div className="space-y-1.5 rounded-xl border border-border bg-surface-raised p-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-foreground text-sm">
          <span>📋 全体総括</span>
          <span
            className={`rounded-full px-2 py-0.5 font-semibold text-[10px] ${
              result.issues.length === 0
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            指摘件数: {result.issues.length} 件
          </span>
        </div>
        <MarkdownText
          compact
          content={result.summary}
          className="text-muted-foreground"
        />
      </div>

      {/* 指摘一覧 */}
      <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
        {result.issues.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs italic">
            キャラクターの口調や一人称の矛盾は見つかりませんでした。設定通りに執筆されています。
          </div>
        ) : (
          result.issues.map((issue, idx) => {
            const typeConfig = ISSUE_TYPE_LABELS[issue.issueType] ?? {
              label: issue.issueType,
              variant: "slate" as const,
            };

            return (
              <div
                key={idx}
                className="space-y-2.5 rounded-lg border border-border bg-surface p-3.5 text-xs shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">
                      👤 {issue.characterName}
                    </span>
                    <Badge variant={typeConfig.variant} size="sm">
                      {typeConfig.label}
                    </Badge>
                  </div>

                  {onApplyFix && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        onApplyFix(issue.dialogue, issue.suggestion)
                      }
                    >
                      本文に反映
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="rounded border border-rose-500/20 bg-rose-500/5 p-2 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                    <span className="mr-1 font-semibold">該当箇所:</span>
                    {issue.dialogue}
                  </div>
                  <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <span className="mr-1 font-semibold">修正案:</span>👉{" "}
                    {issue.suggestion}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  💡 <span className="font-semibold">理由:</span> {issue.reason}
                </p>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
