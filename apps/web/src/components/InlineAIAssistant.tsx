import { useEffect, useState } from 'react';
import { Button } from './Button.js';
import { formatElapsed } from './AIProgressIndicator.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { useCustomPrompts } from '@/hooks/useCustomPrompts.js';
import type { CustomPrompt, InlineAssistAction } from '@/lib/types.js';

interface InlineAIAssistantProps {
  selectedText: string;
  novelId?: string | null;
  onApplyReplace: (generatedText: string) => void;
  onApplyInsertAfter: (generatedText: string) => void;
  onCancel: () => void;
  onExecuteAssist: (
    action: InlineAssistAction,
    customInstruction?: string,
    customPromptId?: string | null,
    variantCount?: number,
  ) => Promise<void>;
  onOpenPromptManager?: () => void;
  isLoading: boolean;
  startedAt?: number | null;
  variants: string[];
  activeVariantIndex: number;
  onSelectVariantIndex: (index: number) => void;
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
  const [customInstruction, setCustomInstruction] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [variantCount, setVariantCount] = useState<number>(2); // デフォルト2案比較
  const [viewMode, setViewMode] = useState<'tabs' | 'split'>('tabs');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // カスタムプロンプト取得（インラインカテゴリ）
  const { prompts: customPrompts } = useCustomPrompts({
    novelId,
    category: 'inline',
    autoFetch: true,
  });

  useEffect(() => {
    if (!isLoading || !startedAt) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const id = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [isLoading, startedAt]);

  const hasGeneratedContent = variants.some((v) => v.trim().length > 0);
  const currentVariantText = variants[activeVariantIndex] ?? variants[0] ?? '';

  const handleExecuteBuiltin = (action: InlineAssistAction) => {
    void onExecuteAssist(action, undefined, undefined, variantCount);
  };

  const handleExecuteCustomPrompt = (prompt: CustomPrompt) => {
    void onExecuteAssist('template', undefined, prompt.id, variantCount);
  };

  const handleExecuteCustomInstruction = () => {
    if (!customInstruction.trim()) return;
    void onExecuteAssist('custom', customInstruction.trim(), undefined, variantCount);
  };

  return (
    <div className="rounded-xl border border-primary/40 bg-surface-raised p-4 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">✨ インライン AI 推敲・加筆</span>
          <span className="text-[11px] text-muted-foreground bg-surface px-2 py-0.5 rounded border border-border">
            選択中: {selectedText.length.toLocaleString()} 文字
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* バリエーション候補数トグル（実行前のみ切替可能） */}
          {!isLoading && !hasGeneratedContent && (
            <div className="flex items-center gap-1.5 bg-surface border border-border px-2 py-0.5 rounded-lg text-xs">
              <span className="text-muted-foreground text-[11px]">候補数:</span>
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setVariantCount(num)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition ${
                    variantCount === num
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
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
              className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
              title="カスタムプロンプトの管理"
            >
              🪄 プロンプト管理
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
          >
            ✕ 閉じる
          </button>
        </div>
      </div>

      {/* 選択テキストのプレビュー */}
      <div className="max-h-16 overflow-y-auto rounded bg-surface border border-border/70 p-2 text-xs text-muted-foreground italic leading-relaxed">
        &ldquo;{selectedText}&rdquo;
      </div>

      {/* アクション選択画面 */}
      {!isLoading && !hasGeneratedContent && (
        <div className="space-y-3">
          {/* 基本アクション */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-muted-foreground px-0.5">標準アクション</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.action}
                  type="button"
                  onClick={() => handleExecuteBuiltin(opt.action)}
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
          </div>

          {/* カスタムプロンプト一覧 */}
          {customPrompts.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border/60">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-0.5">
                <span>登録済みカスタムプロンプト</span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  {customPrompts.length} 件
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {customPrompts.map((cp) => (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => handleExecuteCustomPrompt(cp)}
                    className="flex items-center gap-2 rounded-lg border border-primary/20 bg-surface p-2 text-left hover:border-primary hover:bg-primary/5 transition cursor-pointer group"
                  >
                    <span className="text-base shrink-0">{cp.icon || '🪄'}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                        {cp.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {cp.description || cp.userPrompt}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 自由指示入力 */}
          <div className="pt-1 border-t border-border/60">
            {showCustomInput ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="自由な指示（例: もっと緊迫感を出す、皮肉っぽく、文末を体言止めに）"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleExecuteCustomInstruction();
                    }
                  }}
                  className="flex-1 rounded-md border border-primary px-3 py-1.5 text-xs text-foreground bg-surface focus:outline-none"
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
                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer pt-1"
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
          <div className="flex flex-wrap items-center justify-between gap-2 bg-surface p-1.5 rounded-lg border border-border">
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
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <span>案 {idx + 1}</span>
                    {charCount > 0 && (
                      <span
                        className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                          isActive
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
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
                <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-surface-raised">
                  <button
                    type="button"
                    onClick={() => setViewMode('tabs')}
                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                      viewMode === 'tabs'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    タブ
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('split')}
                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                      viewMode === 'split'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    並列比較
                  </button>
                </div>
              )}

              {isLoading && (
                <span className="text-muted-foreground font-mono text-[11px] flex items-center gap-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />(
                  {formatElapsed(elapsedSeconds)})
                </span>
              )}
            </div>
          </div>

          {/* 生成本文のプレビュー表示 */}
          {viewMode === 'split' && variants.length > 1 ? (
            /* 並列比較（Split View） */
            <div
              className={`grid gap-2 max-h-56 overflow-y-auto ${
                variants.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
              }`}
            >
              {variants.map((vText, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectVariantIndex(idx)}
                  className={`rounded-lg border p-2.5 text-xs leading-relaxed space-y-1.5 cursor-pointer transition ${
                    activeVariantIndex === idx
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-surface hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                    <span className={activeVariantIndex === idx ? 'text-primary' : ''}>
                      案 {idx + 1} {activeVariantIndex === idx && '（選択中）'}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {vText.length} 文字
                    </span>
                  </div>
                  <div className="text-foreground max-h-40 overflow-y-auto">
                    {vText ? (
                      <MarkdownText compact content={vText} className="text-foreground" />
                    ) : (
                      <span className="text-muted-foreground italic">生成待機中...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* タブ表示（単一詳細） */
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed max-h-48 overflow-y-auto space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-primary">
                <span className="flex items-center gap-1.5">
                  {isLoading && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
                  {isLoading
                    ? currentVariantText
                      ? `✍️ 案 ${activeVariantIndex + 1} を生成中...`
                      : '🤖 文脈と思考を解析中...'
                    : `🎉 案 ${activeVariantIndex + 1} の生成結果`}
                </span>
                <span className="text-muted-foreground font-mono">
                  {currentVariantText.length.toLocaleString()} 文字
                </span>
              </div>
              {currentVariantText ? (
                <MarkdownText compact content={currentVariantText} className="text-foreground" />
              ) : (
                <div className="py-2 text-muted-foreground italic">
                  LLMからの応答を待機しています...
                </div>
              )}
            </div>
          )}

          {/* フッターアクション */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
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
