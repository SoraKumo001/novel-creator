import { useRef, useState } from "react";
import { MarkdownText } from "@/components/MarkdownText.js";
import { formatCharCount } from "@/lib/format.js";
import type { ProofreadResult } from "@/lib/types.js";
import { AIProgressIndicator } from "./AIProgressIndicator.js";
import { Badge, type BadgeVariant } from "./Badge.js";
import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

interface ProofreadModalProps {
  isLoading: boolean;
  isOpen: boolean;
  onApplyPolishedBody?: (newBody: string) => void;
  onCancel?: () => void;
  onClose: () => void;
  result: ProofreadResult | null;
}

const TYPE_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  viewpoint: { label: "視点ブレ", variant: "rose" },
  typo: { label: "誤字・表記揺れ", variant: "amber" },
  grammar: { label: "文法・助詞", variant: "orange" },
  pacing: { label: "リズム・テンポ", variant: "blue" },
  consistency: { label: "設定整合性", variant: "purple" },
  other: { label: "その他", variant: "slate" },
};

export function ProofreadModal({
  isOpen,
  onClose,
  result,
  isLoading,
  onApplyPolishedBody,
  onCancel,
}: ProofreadModalProps) {
  const [activeTab, setActiveTab] = useState<"issues" | "polished">("issues");
  const startTimeRef = useRef<number>(Date.now());
  const wasLoadingRef = useRef(false);

  if (isLoading && !wasLoadingRef.current) {
    startTimeRef.current = Date.now();
  }
  wasLoadingRef.current = isLoading;

  if (isLoading) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onCancel ?? onClose}
        title="AI 校正・推敲レビュー"
        size="lg"
      >
        <AIProgressIndicator
          stage="プロ編集者の視点で文章を精読中..."
          description="視点ブレ・誤字脱字・リズム・設定整合性を総合的にチェックし、推敲案を作成しています"
          startedAt={startTimeRef.current}
          onCancel={onCancel ?? onClose}
          cancelLabel="校正を中止"
          variant="panel"
        />
      </Modal>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI 校正・推敲レビュー結果"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
          {onApplyPolishedBody && (
            <Button
              variant="primary"
              onClick={() => {
                onApplyPolishedBody(result.polishedBody);
                onClose();
              }}
            >
              ✍️ 推敲後テキストを本文に反映する
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* スコア & 総評ヘッダー */}
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface-raised p-4 sm:flex-row">
          <div className="flex min-w-24 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-surface p-3 text-center">
            <span className="font-semibold text-[10px] text-muted-foreground">
              総合スコア
            </span>
            <span
              className={`font-black text-3xl ${
                result.score >= 80
                  ? "text-emerald-600 dark:text-emerald-400"
                  : result.score >= 60
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {result.score}
            </span>
            <span className="text-[10px] text-muted-foreground">/ 100点</span>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5 text-sm">
            <div className="font-bold text-foreground">編集者・査読者総評</div>
            <MarkdownText
              compact
              content={result.critique}
              className="text-muted-foreground text-xs"
            />
            {result.advice && (
              <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-primary text-xs leading-relaxed">
                💡 <span className="font-semibold">改善のヒント:</span>{" "}
                <MarkdownText
                  compact
                  content={result.advice}
                  className="text-primary"
                />
              </div>
            )}
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="flex border-border border-b">
          <button
            type="button"
            onClick={() => setActiveTab("issues")}
            className={`cursor-pointer border-b-2 px-4 py-2 font-semibold text-xs transition ${
              activeTab === "issues"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            🔍 指摘事項・改善ポイント ({result.issues.length} 件)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("polished")}
            className={`cursor-pointer border-b-2 px-4 py-2 font-semibold text-xs transition ${
              activeTab === "polished"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            ✨ 推敲後テキスト案
          </button>
        </div>

        {/* タブコンテンツ */}
        {activeTab === "issues" ? (
          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {result.issues.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs italic">
                気になる問題点は検出されませんでした。素晴らしい文章です！
              </div>
            ) : (
              result.issues.map((issue, idx) => {
                const config = TYPE_CONFIG[issue.type] ?? TYPE_CONFIG.other;
                return (
                  <div
                    key={idx}
                    className="space-y-2 rounded-lg border border-border bg-surface p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant={config.variant} size="sm">
                        {config.label}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="rounded border border-rose-500/20 bg-rose-500/5 p-2 text-rose-700 line-through decoration-rose-500/60 dark:bg-rose-500/10 dark:text-rose-300">
                        {issue.originalText}
                      </div>
                      <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        👉 {issue.suggestion}
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      💬 {issue.reason}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>
                推敲後テキスト ({formatCharCount(result.polishedBody.length)})
              </span>
            </div>
            <textarea
              readOnly
              value={result.polishedBody}
              rows={12}
              className="w-full select-all rounded-lg border border-border bg-surface-raised p-3 font-mono text-foreground text-xs leading-relaxed focus:outline-none"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
