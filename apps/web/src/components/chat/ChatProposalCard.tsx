import { Button } from "@/components/Button.js";
import { ProposalCardBody } from "./ProposalCardView.js";
import { ProposalDiffModal } from "./ProposalDiffModal.js";
import type { ProposalPayload } from "./proposalTypes.js";
import { useProposalApply } from "./useProposalApply.js";

// 互換のための再エクスポート（既存の import パスを維持する）
export type {
  BulkCharacterItem,
  BulkForeshadowingItem,
  BulkProposalData,
  BulkSettingItem,
  BulkTimelineItem,
  CharacterProposalData,
  DeleteProposalData,
  ForeshadowingProposalData,
  ForeshadowingStatus,
  NormalizedBulkProposal,
  PlotProposalData,
  ProposalPayload,
  SettingProposalData,
  StoryOutlineMode,
  StoryOutlineProposalData,
  TimelineProposalData,
} from "./proposalTypes.js";
export {
  canShowProposalDiff,
  normalizeProposal,
  resolveCleanSummary,
  resolveSafeSectionName,
  resolveTargetNovelId,
  toRouteTab,
} from "./proposalTypes.js";

interface ChatProposalCardProps {
  proposal: ProposalPayload;
}

const TYPE_BADGES: Record<string, { label: string; bg: string }> = {
  bulk: {
    label: "📦 一括登録",
    bg: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  },
  character: {
    label: "👤 登場人物",
    bg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
  },
  setting: {
    label: "🌍 世界観・設定",
    bg: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
  },
  delete_setting: {
    label: "🗑️ 設定削除",
    bg: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  },
  delete_character: {
    label: "🗑️ 人物削除",
    bg: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  },
  foreshadowing: {
    label: "🔍 伏線",
    bg: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  timeline: {
    label: "⏳ 年表イベント",
    bg: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  },
  plot: {
    label: "📖 プロット",
    bg: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  },
  story_outline: {
    label: "🗺️ ストーリー構想",
    bg: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
};

export function ChatProposalCard({ proposal }: ChatProposalCardProps) {
  const {
    status,
    setStatus,
    isApplying,
    diffLoading,
    diffModalOpen,
    setDiffModalOpen,
    diffData,
    targetNovelId,
    safeSectionName,
    cleanSummary,
    canShowDiff,
    handleApply,
    handleOpenDiff,
    handleOpenInEditor,
  } = useProposalApply(proposal);

  const { proposalType, data } = proposal;
  const isApplied = status === "applied";
  const isDismissed = status === "dismissed";

  const badge = TYPE_BADGES[proposalType] || {
    label: "💡 設定提案",
    bg: "bg-slate-100 text-slate-800",
  };

  const isDeleteOnly =
    proposalType === "delete_setting" || proposalType === "delete_character";

  const isApplyDisabled =
    isApplying ||
    diffLoading ||
    !targetNovelId ||
    (proposalType === "story_outline" && !data.content?.trim());

  const applyDisabledReason = !targetNovelId
    ? "対象の小説を選ぶと反映できます"
    : proposalType === "story_outline" && !data.content?.trim()
      ? "本文が空のため反映できません"
      : isApplying || diffLoading
        ? "処理中です。終わるまでお待ちください"
        : null;

  const cardBorderClass = isApplied
    ? "border-emerald-300 bg-linear-to-br from-emerald-50/90 to-teal-50/40 dark:border-emerald-800/80 dark:from-emerald-950/30 dark:to-teal-950/20"
    : isDismissed
      ? "border-slate-200 bg-slate-50/60 opacity-60 dark:border-slate-800 dark:bg-slate-900/30"
      : isDeleteOnly
        ? "border-rose-200 bg-linear-to-br from-rose-50/90 to-amber-50/40 dark:border-rose-900/60 dark:from-rose-950/30 dark:to-amber-950/20"
        : "border-indigo-200 bg-linear-to-br from-indigo-50/90 to-purple-50/40 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-purple-950/20";

  return (
    <div
      className={`my-3 overflow-hidden rounded-xl border p-3 shadow-xs transition motion-reduce:transition-none ${cardBorderClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">
            {isApplied ? "✔" : isDeleteOnly ? "🗑️" : "💡"}
          </span>
          <span className="font-bold text-slate-800 text-xs dark:text-slate-200">
            {isApplied
              ? "小説データに反映完了"
              : isDeleteOnly
                ? "設定削除の提案"
                : "設定反映の提案"}
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 font-semibold text-[10px] ${badge.bg}`}
          >
            {badge.label}
          </span>
        </div>

        {isApplied ? (
          <span className="flex items-center gap-1 font-semibold text-[11px] text-emerald-700 dark:text-emerald-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            <span>反映済み</span>
          </span>
        ) : isDismissed ? (
          <span className="font-medium text-[11px] text-slate-400">
            スキップ済み
          </span>
        ) : (
          <span
            className={`font-medium text-[11px] ${
              isDeleteOnly
                ? "text-rose-700 dark:text-rose-400"
                : "text-indigo-700 dark:text-indigo-400"
            }`}
          >
            {isDeleteOnly ? "ワンクリックで削除実行" : "ワンクリックで登録可能"}
          </span>
        )}
      </div>

      <ProposalCardBody
        proposal={proposal}
        safeSectionName={safeSectionName}
        targetNovelId={targetNovelId}
      />

      <div className="mt-2.5 flex flex-col gap-2 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
        {isApplied ? (
          <div className="flex items-center gap-1.5 font-medium text-emerald-800 text-xs dark:text-emerald-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            <span>✔ 小説データに反映完了: {cleanSummary}</span>
          </div>
        ) : isDismissed ? (
          <div className="text-slate-400 text-xs">
            ✕ 提案をスキップしました（{cleanSummary}）
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
              {cleanSummary}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {canShowDiff && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleOpenDiff()}
                  disabled={isApplying || diffLoading}
                  isLoading={diffLoading}
                >
                  🔍 差分を確認
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setStatus("dismissed")}
                disabled={isApplying || diffLoading}
              >
                破棄
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => void handleApply()}
                disabled={isApplyDisabled}
                title={applyDisabledReason ?? "小説に反映する"}
              >
                {isApplying ? "反映中..." : "✔ 小説に反映する"}
              </Button>
            </div>
            {applyDisabledReason && !isApplying && !diffLoading && (
              <p className="text-[11px] text-muted-foreground">
                {applyDisabledReason}
              </p>
            )}
          </>
        )}
      </div>

      {diffData && (
        <ProposalDiffModal
          isOpen={diffModalOpen}
          onClose={() => setDiffModalOpen(false)}
          title={diffData.title}
          proposalSummary={cleanSummary}
          originalMarkdown={diffData.originalMarkdown}
          updatedMarkdown={diffData.updatedMarkdown}
          diffItems={diffData.diffItems}
          onApply={handleApply}
          onOpenInEditor={handleOpenInEditor}
          isApplying={isApplying}
        />
      )}
    </div>
  );
}
