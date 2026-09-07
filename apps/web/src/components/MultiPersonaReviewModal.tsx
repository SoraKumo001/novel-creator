import { useState } from "react";
import { MarkdownText } from "@/components/MarkdownText.js";
import type { AnalysisProgress } from "@/hooks/useAnalysis.js";
import type {
  AnalysisHistoryEntry,
  MultiPersonaReviewResult,
  ReaderPersonaType,
} from "@/lib/types.js";
import { AnalysisModalShell } from "./AnalysisModalShell.js";

interface MultiPersonaReviewModalProps {
  error?: string | null;
  historyRefreshKey?: number;
  isHistoryView?: boolean;
  isOpen: boolean;
  novelId: string;
  onCancel: () => void;
  onClose: () => void;
  onRerun: () => void;
  onSelectHistory: (entry: AnalysisHistoryEntry) => void;
  progress: AnalysisProgress | null;
  result: MultiPersonaReviewResult | null;
  running: boolean;
  viewedAt?: string | null;
}

const PERSONA_CONFIG: Record<
  ReaderPersonaType,
  { icon: string; title: string; color: string; badge: string }
> = {
  editor: {
    icon: "👔",
    title: "商業文芸・ラノベ編集者",
    color: "border-blue-500/30 bg-blue-500/5",
    badge: "bg-blue-500/10 text-blue-600",
  },
  casual: {
    icon: "🍿",
    title: "一般エンタメ読者",
    color: "border-emerald-500/30 bg-emerald-500/5",
    badge: "bg-emerald-500/10 text-emerald-600",
  },
  lore: {
    icon: "🔍",
    title: "世界観・設定考察派ファン",
    color: "border-purple-500/30 bg-purple-500/5",
    badge: "bg-purple-500/10 text-purple-600",
  },
  critic: {
    icon: "🖋️",
    title: "辛口文芸評論家",
    color: "border-rose-500/30 bg-rose-500/5",
    badge: "bg-rose-500/10 text-rose-600",
  },
};

export function MultiPersonaReviewModal({
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
}: MultiPersonaReviewModalProps) {
  const [selectedPersona, setSelectedPersona] =
    useState<ReaderPersonaType>("editor");

  return (
    <AnalysisModalShell
      analysisType="persona-review"
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
      runningTitle="模擬読者レビューを生成中…"
      showHistoryBanner={isHistoryView && result !== null}
      title="👥 複数ペルソナによる模擬読者・編集部レビュー"
      viewedAt={viewedAt}
    >
      {result && (
        <ResultBody
          result={result}
          selectedPersona={selectedPersona}
          onSelectPersona={setSelectedPersona}
        />
      )}
    </AnalysisModalShell>
  );
}

function ResultBody({
  result,
  selectedPersona,
  onSelectPersona,
}: {
  result: MultiPersonaReviewResult;
  selectedPersona: ReaderPersonaType;
  onSelectPersona: (p: ReaderPersonaType) => void;
}) {
  const currentReview =
    result.reviews.find((r) => r.persona === selectedPersona) ??
    result.reviews[0];
  const personaConfig = PERSONA_CONFIG[currentReview?.persona ?? "editor"];

  return (
    <>
      {/* 全体読後感 */}
      <div className="space-y-1.5 rounded-xl border border-border bg-surface-raised p-4 text-xs">
        <div className="font-bold text-foreground text-sm">
          📋 査読チーム総合インプレッション
        </div>
        <MarkdownText
          compact
          content={result.overallImpression}
          className="text-muted-foreground"
        />
      </div>

      {/* ペルソナ選択タブ */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {result.reviews.map((rev) => {
          const config = PERSONA_CONFIG[rev.persona];
          const isSelected = rev.persona === selectedPersona;
          return (
            <button
              key={rev.persona}
              type="button"
              onClick={() => onSelectPersona(rev.persona)}
              className={`flex cursor-pointer flex-col items-start rounded-xl border p-3 text-left transition ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-surface hover:bg-surface-raised"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-lg">{config.icon}</span>
                <span className="font-bold text-amber-500 text-xs">
                  {"★".repeat(rev.rating)}
                  {"☆".repeat(5 - rev.rating)}
                </span>
              </div>
              <div className="mt-1 w-full truncate font-bold text-foreground text-xs">
                {rev.personaName}
              </div>
            </button>
          );
        })}
      </div>

      {/* 選択されたペルソナの詳細レビューカード */}
      {currentReview && (
        <div
          className={`fade-in animate-in space-y-4 rounded-xl border p-5 transition duration-200 ${personaConfig.color}`}
        >
          <div className="space-y-1.5 border-border/60 border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{personaConfig.icon}</span>
                <span className="font-bold text-foreground text-sm">
                  {currentReview.personaName} の講評
                </span>
              </div>
              <span className="font-black text-amber-500 text-sm">
                {"★".repeat(currentReview.rating)}
                {"☆".repeat(5 - currentReview.rating)} ({currentReview.rating} /
                5 点)
              </span>
            </div>
            <div className="rounded-lg border border-border/50 bg-surface/80 p-2 font-semibold text-foreground text-xs italic">
              &ldquo;{currentReview.catchphrase}&rdquo;
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="space-y-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <span>✨ 良かった点・魅力</span>
              </div>
              <MarkdownText
                compact
                content={currentReview.praise}
                className="text-muted-foreground"
              />
            </div>

            <div className="space-y-1 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <div className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
                <span>💬 改善が望まれる点・懸念</span>
              </div>
              <MarkdownText
                compact
                content={currentReview.criticism}
                className="text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-surface p-3 text-xs">
            <div className="flex items-center gap-1 font-bold text-primary">
              <span>💡 このペルソナからのリライト助言:</span>
            </div>
            <MarkdownText
              compact
              content={currentReview.advice}
              className="text-foreground"
            />
          </div>
        </div>
      )}
    </>
  );
}
