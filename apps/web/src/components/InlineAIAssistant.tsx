import { useState } from 'react';
import { Button } from './Button.js';
import type { InlineAssistAction } from '@/lib/types.js';

interface InlineAIAssistantProps {
  selectedText: string;
  onApplyReplace: (generatedText: string) => void;
  onApplyInsertAfter: (generatedText: string) => void;
  onCancel: () => void;
  onExecuteAssist: (action: InlineAssistAction, customInstruction?: string) => Promise<void>;
  isLoading: boolean;
  generatedText: string;
}

const ACTION_OPTIONS: Array<{
  action: InlineAssistAction;
  label: string;
  icon: string;
  desc: string;
}> = [
  { action: 'expand', label: '描写を深める', icon: '🌿', desc: '五感や情景、雰囲気を肉付け' },
  {
    action: 'emotional',
    label: '心理・感情強化',
    icon: '💓',
    desc: 'キャラクターの葛藤や感情を掘り下げる',
  },
  {
    action: 'dialogue',
    label: '会話をテンポよく',
    icon: '💬',
    desc: 'セリフの掛け合いや個性を引き出す',
  },
  { action: 'shorten', label: '簡潔にする', icon: '✂️', desc: '冗長さを削ぎ落としテンポアップ' },
  { action: 'paraphrase', label: '別の言い回し', icon: '✨', desc: '表現や比喩のバリエーション' },
];

export function InlineAIAssistant({
  selectedText,
  onApplyReplace,
  onApplyInsertAfter,
  onCancel,
  onExecuteAssist,
  isLoading,
  generatedText,
}: InlineAIAssistantProps) {
  const [customInstruction, setCustomInstruction] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  return (
    <div className="rounded-xl border border-primary/40 bg-surface-raised p-4 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">✨ インライン AI 推敲・加筆</span>
          <span className="text-[11px] text-muted-foreground bg-surface px-2 py-0.5 rounded border border-border">
            選択中: {selectedText.length.toLocaleString()} 文字
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
        >
          ✕ 閉じる
        </button>
      </div>

      {/* 選択テキストのプレビュー */}
      <div className="max-h-20 overflow-y-auto rounded bg-surface border border-border/70 p-2 text-xs text-muted-foreground italic leading-relaxed">
        &ldquo;{selectedText}&rdquo;
      </div>

      {/* アクションボタン群 */}
      {!isLoading && !generatedText && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {ACTION_OPTIONS.map((opt) => (
              <button
                key={opt.action}
                type="button"
                onClick={() => void onExecuteAssist(opt.action)}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 text-left hover:border-primary hover:bg-primary/5 transition cursor-pointer group"
              >
                <span className="text-base shrink-0">{opt.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground group-hover:text-primary">
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* カスタム指示 */}
          {showCustomInput ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                autoFocus
                placeholder="自由な指示（例: もっと緊迫感を出す、皮肉っぽく）"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customInstruction.trim()) {
                    void onExecuteAssist('custom', customInstruction.trim());
                  }
                }}
                className="flex-1 rounded-md border border-primary px-3 py-1.5 text-xs text-foreground bg-surface focus:outline-none"
              />
              <Button
                size="sm"
                variant="primary"
                disabled={!customInstruction.trim()}
                onClick={() => void onExecuteAssist('custom', customInstruction.trim())}
              >
                実行
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCustomInput(true)}
              className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer pt-1"
            >
              ✏️ 自由な指示を入力して書き換える...
            </button>
          )}
        </div>
      )}

      {/* 生成中 / 生成結果表示 */}
      {(isLoading || generatedText) && (
        <div className="space-y-3">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed max-h-48 overflow-y-auto space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-primary">
              <span>{isLoading ? '🤖 AIが執筆・推敲中...' : '🎉 生成結果'}</span>
              <span>{generatedText.length.toLocaleString()} 文字</span>
            </div>
            <div className="whitespace-pre-wrap text-foreground">{generatedText}</div>
          </div>

          {!isLoading && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={onCancel}>
                破棄
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onApplyInsertAfter(generatedText)}
              >
                選択範囲の直後に挿入
              </Button>
              <Button size="sm" variant="primary" onClick={() => onApplyReplace(generatedText)}>
                ✍️ 選択範囲を置換
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
