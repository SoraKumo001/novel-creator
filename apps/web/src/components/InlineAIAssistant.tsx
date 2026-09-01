import { useEffect, useState } from "react";
import { MarkdownText } from "@/components/MarkdownText.js";
import { useCustomPrompts } from "@/hooks/useCustomPrompts.js";
import type { CustomPrompt, InlineAssistAction } from "@/lib/types.js";
import { formatElapsed } from "./AIProgressIndicator.js";
import { Button } from "./Button.js";

interface InlineAIAssistantProps {
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

const ACTION_OPTIONS: Array<{
  action: InlineAssistAction;
  label: string;
  icon: string;
  desc: string;
}> = [
  {
    action: "expand",
    label: "描写を深める",
    icon: "🌿",
    desc: "五感や情景、雰囲気を肉付け",
  },
  {
    action: "emotional",
    label: "心理・感情強化",
    icon: "💓",
    desc: "キャラクターの葛藤や感情を掘り下げる",
  },
  {
    action: "dialogue",
    label: "会話をテンポよく",
    icon: "💬",
    desc: "セリフの掛け合いや個性を引き出す",
  },
  {
    action: "shorten",
    label: "簡潔にする",
    icon: "✂️",
    desc: "冗長さを削ぎ落としテンポアップ",
  },
  {
    action: "paraphrase",
    label: "別の言い回し",
    icon: "✨",
    desc: "表現や比喩のバリエーション",
  },
];

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
  const [customInstruction, setCustomInstruction] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [variantCount, setVariantCount] = useState<number>(2); // デフォルト2案比較
  const [viewMode, setViewMode] = useState<"tabs" | "split">("tabs");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // カスタムプロンプト取得（インラインカテゴリ）
  const { prompts: customPrompts } = useCustomPrompts({
    novelId,
    category: "inline",
    autoFetch: true,
  });

  useEffect(() => {
    if (!isLoading || !startedAt) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const id = setInterval(() => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      );
    }, 1000);
    return () => clearInterval(id);
  }, [isLoading, startedAt]);

  const hasGeneratedContent = variants.some((v) => v.trim().length > 0);
  const currentVariantText = variants[activeVariantIndex] ?? variants[0] ?? "";

  const handleExecuteBuiltin = (action: InlineAssistAction) => {
    void onExecuteAssist(action, undefined, undefined, variantCount);
  };

  const handleExecuteCustomPrompt = (prompt: CustomPrompt) => {
    void onExecuteAssist("template", undefined, prompt.id, variantCount);
  };

  const handleExecuteCustomInstruction = () => {
    if (!customInstruction.trim()) {
      return;
    }
    void onExecuteAssist(
      "custom",
      customInstruction.trim(),
      undefined,
      variantCount
    );
  };

  return (
    <div className="fade-in slide-in-from-top-2 animate-in space-y-3 rounded-xl border border-primary/40 bg-surface-raised p-4 shadow-xl duration-200">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-border border-b pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground text-sm">
            ✨ インライン AI 推敲・加筆
          </span>
          <span className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
            選択中: {selectedText.length.toLocaleString()} 文字
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
        <div className="space-y-3">
          {/* 基本アクション */}
          <div className="space-y-1">
            <div className="px-0.5 font-bold text-[11px] text-muted-foreground">
              標準アクション
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.action}
                  type="button"
                  onClick={() => handleExecuteBuiltin(opt.action)}
                  className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface p-2 text-left transition hover:border-primary hover:bg-primary/5"
                >
                  <span className="shrink-0 text-base">{opt.icon}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground text-xs group-hover:text-primary">
                      {opt.label}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {opt.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* カスタムプロンプト一覧 */}
          {customPrompts.length > 0 && (
            <div className="space-y-1 border-border/60 border-t pt-1">
              <div className="flex items-center justify-between px-0.5 font-bold text-[11px] text-muted-foreground">
                <span>登録済みカスタムプロンプト</span>
                <span className="font-normal text-[10px] text-muted-foreground">
                  {customPrompts.length} 件
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {customPrompts.map((cp) => (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => handleExecuteCustomPrompt(cp)}
                    className="group flex cursor-pointer items-center gap-2 rounded-lg border border-primary/20 bg-surface p-2 text-left transition hover:border-primary hover:bg-primary/5"
                  >
                    <span className="shrink-0 text-base">
                      {cp.icon || "🪄"}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground text-xs group-hover:text-primary">
                        {cp.name}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {cp.description || cp.userPrompt}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 自由指示入力 */}
          <div className="border-border/60 border-t pt-1">
            {showCustomInput ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="自由な指示（例: もっと緊迫感を出す、皮肉っぽく、文末を体言止めに）"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleExecuteCustomInstruction();
                    }
                  }}
                  className="flex-1 rounded-md border border-primary bg-surface px-3 py-1.5 text-foreground text-xs focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!customInstruction.trim()}
                  onClick={handleExecuteCustomInstruction}
                >
                  実行 ({variantCount}案)
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="flex cursor-pointer items-center gap-1 pt-1 text-primary text-xs hover:underline"
              >
                ✏️ 自由な指示を入力して書き換える...
              </button>
            )}
          </div>
        </div>
      )}

      {/* 生成中 / 生成結果表示 */}
      {(isLoading || hasGeneratedContent) && (
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
                      className={
                        activeVariantIndex === idx ? "text-primary" : ""
                      }
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
      )}
    </div>
  );
}
