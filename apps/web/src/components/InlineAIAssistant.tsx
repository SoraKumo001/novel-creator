import { useState } from "react";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds.js";
import { formatCharCount } from "@/lib/format.js";
import type { InlineAssistAction } from "@/lib/types.js";
import { InlineAssistActions } from "./InlineAssistActions.js";
import { InlineVariantView } from "./InlineVariantView.js";

export interface InlineAIAssistantProps {
  activeVariantIndex: number;
  isLoading: boolean;
  novelId?: string | null;
  onApplyInsertAfter: (generatedText: string) => void;
  onApplyReplace: (generatedText: string) => void;
  onCancel: () => void;
  onExecuteAssist: (
    action: InlineAssistAction,
    customInstruction?: string,
    customPromptId?: string | null,
    variantCount?: number
  ) => Promise<void>;
  onOpenPromptManager?: () => void;
  onSelectVariantIndex: (index: number) => void;
  selectedText: string;
  startedAt?: number | null;
  variants: string[];
}

/**
 * インライン AI 推敲・加筆のシェル。
 * 経過時間は useElapsedSeconds（単一 source）に委譲し、
 * アクション選択とバリエーション表示は presentational に分離した。
 */
export function InlineAIAssistant({
  selectedText,
  novelId,
  onApplyReplace,
  onApplyInsertAfter,
  onCancel,
  onExecuteAssist,
  onOpenPromptManager,
  isLoading,
  startedAt,
  variants,
  activeVariantIndex,
  onSelectVariantIndex,
}: InlineAIAssistantProps) {
  const [variantCount, setVariantCount] = useState<number>(2); // デフォルト2案比較

  // 経過時間の単一 source（StreamingStatus のタイマーと重複させない）
  const elapsedSeconds = useElapsedSeconds(isLoading, startedAt);

  const hasGeneratedContent = variants.some((v) => v.trim().length > 0);

  return (
    <div className="fade-in slide-in-from-top-2 animate-in space-y-3 rounded-xl border border-primary/40 bg-surface-raised p-4 shadow-xl duration-200">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-border border-b pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground text-sm">
            ✨ インライン AI 推敲・加筆
          </span>
          <span className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
            選択中: {formatCharCount(selectedText.length)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* バリエーション候補数トグル（実行前のみ切替可能） */}
          {!isLoading && !hasGeneratedContent && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-0.5 text-xs">
              <span className="text-[11px] text-muted-foreground">候補数:</span>
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setVariantCount(num)}
                  className={`cursor-pointer rounded px-1.5 py-0.5 font-semibold text-[11px] transition ${
                    variantCount === num
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {num}案
                </button>
              ))}
            </div>
          )}

          {onOpenPromptManager && !isLoading && !hasGeneratedContent && (
            <button
              type="button"
              onClick={onOpenPromptManager}
              className="flex cursor-pointer items-center gap-1 text-primary text-xs hover:underline"
              title="カスタムプロンプトの管理"
            >
              🪄 プロンプト管理
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer p-1 text-muted-foreground text-xs hover:text-foreground"
          >
            ✕ 閉じる
          </button>
        </div>
      </div>

      {/* 選択テキストのプレビュー */}
      <div className="max-h-16 overflow-y-auto rounded border border-border/70 bg-surface p-2 text-muted-foreground text-xs italic leading-relaxed">
        &ldquo;{selectedText}&rdquo;
      </div>

      {/* アクション選択画面 */}
      {!isLoading && !hasGeneratedContent && (
        <InlineAssistActions
          novelId={novelId}
          variantCount={variantCount}
          onExecuteAssist={onExecuteAssist}
        />
      )}

      {/* 生成中 / 生成結果表示 */}
      {(isLoading || hasGeneratedContent) && (
        <InlineVariantView
          variants={variants}
          activeVariantIndex={activeVariantIndex}
          isLoading={isLoading}
          elapsedSeconds={elapsedSeconds}
          onSelectVariantIndex={onSelectVariantIndex}
          onApplyReplace={onApplyReplace}
          onApplyInsertAfter={onApplyInsertAfter}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}
