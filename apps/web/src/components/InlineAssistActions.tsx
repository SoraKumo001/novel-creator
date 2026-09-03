import { useState } from "react";
import { useCustomPrompts } from "@/hooks/useCustomPrompts.js";
import type { CustomPrompt, InlineAssistAction } from "@/lib/types.js";
import { Button } from "./Button.js";

export const INLINE_ACTION_OPTIONS: Array<{
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

/** アクション選択画面（標準アクション＋カスタム＋自由指示） */
export function InlineAssistActions({
  novelId,
  variantCount,
  onExecuteAssist,
}: {
  novelId?: string | null;
  variantCount: number;
  onExecuteAssist: (
    action: InlineAssistAction,
    customInstruction?: string,
    customPromptId?: string | null,
    variantCount?: number
  ) => Promise<void>;
}) {
  const [customInstruction, setCustomInstruction] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // カスタムプロンプト取得（インラインカテゴリ）
  const { prompts: customPrompts } = useCustomPrompts({
    novelId,
    category: "inline",
    autoFetch: true,
  });

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
    <div className="space-y-3">
      {/* 基本アクション */}
      <div className="space-y-1">
        <div className="px-0.5 font-bold text-[11px] text-muted-foreground">
          標準アクション
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {INLINE_ACTION_OPTIONS.map((opt) => (
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
                <span className="shrink-0 text-base">{cp.icon || "🪄"}</span>
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
  );
}
