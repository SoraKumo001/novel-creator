import { useRef, useState } from "react";
import { MarkdownText } from "@/components/MarkdownText.js";
import type { SettingImpactResult } from "@/lib/types.js";
import { AIProgressIndicator } from "./AIProgressIndicator.js";
import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

interface ImpactAnalysisModalProps {
  beforeValue: string;
  isOpen: boolean;
  onAnalyze: (
    input: {
      changeTarget: "character" | "setting";
      targetName: string;
      beforeValue: string;
      afterValue: string;
    },
    signal?: AbortSignal
  ) => Promise<SettingImpactResult>;
  onClose: () => void;
  targetName: string;
  targetType: "character" | "setting";
}

const IMPACT_BADGES = {
  low: {
    label: "影響度: 小",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  medium: {
    label: "影響度: 中",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  high: {
    label: "影響度: 大（大規模修正）",
    color: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  },
};

const TARGET_TYPE_ICONS: Record<string, string> = {
  plot: "🗺️ プロット",
  section: "📄 節・本文",
  timeline: "⏳ 年表・時系列",
  foreshadowing: "🗝️ 伏線",
};

export function ImpactAnalysisModal({
  isOpen,
  onClose,
  targetType,
  targetName,
  beforeValue,
  onAnalyze,
}: ImpactAnalysisModalProps) {
  const [afterValue, setAfterValue] = useState(beforeValue);
  const [result, setResult] = useState<SettingImpactResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setAnalyzing(false);
  };

  const handleRunAnalysis = async () => {
    if (!afterValue.trim()) {
      return;
    }
    setAnalyzing(true);
    setResult(null);
    startTimeRef.current = Date.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const res = await onAnalyze(
        {
          changeTarget: targetType,
          targetName,
          beforeValue,
          afterValue,
        },
        controller.signal
      );
      setResult(res);
    } catch (e) {
      if ((e as Error)?.name === "AbortError" || controller.signal.aborted) {
        return;
      }
      throw e;
    } finally {
      setAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={analyzing ? handleCancelAnalysis : onClose}
      title="⚡ 設定変更の影響範囲シミュレーター"
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            variant="secondary"
            onClick={analyzing ? handleCancelAnalysis : onClose}
          >
            {analyzing ? "キャンセル" : "閉じる"}
          </Button>
          {!result && !analyzing && (
            <Button
              variant="primary"
              onClick={() => void handleRunAnalysis()}
              disabled={afterValue === beforeValue}
            >
              🔍 影響範囲をシミュレーション分析
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* 入力フォーム（変更前 vs 変更後） */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="font-semibold text-muted-foreground text-xs">
              変更前（現在の設定）: {targetName}
            </label>
            <textarea
              readOnly
              value={beforeValue}
              rows={4}
              className="w-full rounded-lg border border-border bg-surface-raised p-2.5 text-muted-foreground text-xs focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-foreground text-xs">
              変更後（新しい設定案）:
            </label>
            <textarea
              value={afterValue}
              onChange={(e) => setAfterValue(e.target.value)}
              disabled={analyzing}
              rows={4}
              placeholder="新しい設定内容を入力してください..."
              className="w-full rounded-lg border border-primary bg-surface p-2.5 font-medium text-foreground text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* 分析実行中プログレス */}
        {analyzing && (
          <div className="rounded-xl border border-primary/30 bg-surface-raised p-4 shadow-inner">
            <AIProgressIndicator
              stage="全プロット・章節・年表・伏線との整合性を検証中..."
              description="設定の変更による物語全体の矛盾や影響箇所をAIが網羅的にスキャンしています"
              startedAt={startTimeRef.current}
              onCancel={handleCancelAnalysis}
              cancelLabel="分析を中止"
              variant="panel"
            />
          </div>
        )}

        {result && (
          <div className="fade-in animate-in space-y-3 duration-200">
            {/* 総括カード */}
            <div className="space-y-2 rounded-xl border border-border bg-surface-raised p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground text-sm">
                  📋 影響分析サマリー
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-semibold text-xs ${
                    IMPACT_BADGES[result.impactLevel]?.color ?? ""
                  }`}
                >
                  {IMPACT_BADGES[result.impactLevel]?.label}
                </span>
              </div>
              <MarkdownText
                compact
                content={result.summary}
                className="text-muted-foreground text-xs"
              />
            </div>

            {/* 影響箇所リスト */}
            <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
              <div className="font-semibold text-foreground text-xs">
                影響を受ける箇所 ({result.affectedItems.length} 件):
              </div>
              {result.affectedItems.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-xs italic">
                  既存のプロットや章節への悪影響は見つかりませんでした。安全に変更できます。
                </div>
              ) : (
                result.affectedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="space-y-1.5 rounded-lg border border-border bg-surface p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">
                        {TARGET_TYPE_ICONS[item.targetType] ?? item.targetType}:{" "}
                        {item.targetTitle}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-600 leading-relaxed dark:text-rose-400">
                      ⚠️ <span className="font-semibold">矛盾点:</span>{" "}
                      {item.issue}
                    </p>
                    <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2 text-[11px] text-emerald-700 leading-relaxed dark:bg-emerald-500/10 dark:text-emerald-300">
                      👉 <span className="font-semibold">推奨される修正:</span>{" "}
                      {item.suggestedFix}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
