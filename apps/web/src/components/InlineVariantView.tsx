import { useState } from "react";
import { MarkdownText } from "@/components/MarkdownText.js";
import { formatElapsed } from "./AIProgressIndicator.js";
import { Button } from "./Button.js";

/** 生成結果のバリエーション表示（タブ / 並列比較＋フッター操作） */
export function InlineVariantView({
  variants,
  activeVariantIndex,
  isLoading,
  elapsedSeconds,
  onSelectVariantIndex,
  onApplyReplace,
  onApplyInsertAfter,
  onCancel,
}: {
  variants: string[];
  activeVariantIndex: number;
  isLoading: boolean;
  elapsedSeconds: number;
  onSelectVariantIndex: (index: number) => void;
  onApplyReplace: (generatedText: string) => void;
  onApplyInsertAfter: (generatedText: string) => void;
  onCancel: () => void;
}) {
  const [viewMode, setViewMode] = useState<"tabs" | "split">("tabs");
  const currentVariantText = variants[activeVariantIndex] ?? variants[0] ?? "";

  return (
    <div className="space-y-3">
      {/* バリエーション切替タブ & 表示モード切替 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-1.5">
        {/* 候補タブ */}
        <div className="flex items-center gap-1">
          {variants.map((vText, idx) => {
            const isActive = activeVariantIndex === idx;
            const charCount = vText.length;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectVariantIndex(idx)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 font-semibold text-xs transition ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>案 {idx + 1}</span>
                {charCount > 0 && (
                  <span
                    className={`rounded px-1 py-0.2 font-mono text-[10px] ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {charCount}字
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 表示モード & 時間 */}
        <div className="flex items-center gap-2 text-xs">
          {variants.length > 1 && (
            <div className="flex items-center gap-1 rounded-md border border-border bg-surface-raised p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("tabs")}
                className={`cursor-pointer rounded px-2 py-0.5 text-[10px] ${
                  viewMode === "tabs"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                タブ
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`cursor-pointer rounded px-2 py-0.5 text-[10px] ${
                  viewMode === "split"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                並列比較
              </button>
            </div>
          )}

          {isLoading && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              ({formatElapsed(elapsedSeconds)})
            </span>
          )}
        </div>
      </div>

      {/* 生成本文のプレビュー表示 */}
      {viewMode === "split" && variants.length > 1 ? (
        /* 並列比較（Split View） */
        <div
          className={`grid max-h-56 gap-2 overflow-y-auto ${
            variants.length === 2 ? "grid-cols-2" : "grid-cols-3"
          }`}
        >
          {variants.map((vText, idx) => (
            <div
              key={idx}
              onClick={() => onSelectVariantIndex(idx)}
              className={`cursor-pointer space-y-1.5 rounded-lg border p-2.5 text-xs leading-relaxed transition ${
                activeVariantIndex === idx
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border bg-surface hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between font-bold text-[11px] text-foreground">
                <span
                  className={activeVariantIndex === idx ? "text-primary" : ""}
                >
                  案 {idx + 1} {activeVariantIndex === idx && "（選択中）"}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {vText.length} 文字
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto text-foreground">
                {vText ? (
                  <MarkdownText
                    compact
                    content={vText}
                    className="text-foreground"
                  />
                ) : (
                  <span className="text-muted-foreground italic">
                    生成待機中...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* タブ表示（単一詳細） */
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
          <div className="flex items-center justify-between font-semibold text-[11px] text-primary">
            <span className="flex items-center gap-1.5">
              {isLoading && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              )}
              {isLoading
                ? currentVariantText
                  ? `✍️ 案 ${activeVariantIndex + 1} を生成中...`
                  : "🤖 文脈と思考を解析中..."
                : `🎉 案 ${activeVariantIndex + 1} の生成結果`}
            </span>
            <span className="font-mono text-muted-foreground">
              {currentVariantText.length.toLocaleString()} 文字
            </span>
          </div>
          {currentVariantText ? (
            <MarkdownText
              compact
              content={currentVariantText}
              className="text-foreground"
            />
          ) : (
            <div className="py-2 text-muted-foreground italic">
              LLMからの応答を待機しています...
            </div>
          )}
        </div>
      )}

      {/* フッターアクション */}
      <div className="flex items-center justify-between gap-2 border-border/60 border-t pt-1">
        <div className="text-[11px] text-muted-foreground">
          {variants.length > 1 && !isLoading && (
            <span>現在「案 {activeVariantIndex + 1}」を選択中</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <Button size="sm" variant="danger" onClick={onCancel}>
              ■ 停止
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={onCancel}>
                破棄
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!currentVariantText}
                onClick={() => onApplyInsertAfter(currentVariantText)}
              >
                直後に挿入 (案{activeVariantIndex + 1})
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!currentVariantText}
                onClick={() => onApplyReplace(currentVariantText)}
              >
                ✍️ 選択範囲を置換 (案{activeVariantIndex + 1})
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
