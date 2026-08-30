import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button.js';
import { LLMModelSelector } from '@/components/LLMModelSelector.js';
import type { Section } from '@/lib/types.js';
import { PencilIcon, SparklesIcon } from './-Icons.js';

interface EditorToolbarProps {
  section: Section;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  wordCount: number;
  isDirty: boolean;
  saving: boolean;
  targetWords: number;
  onTargetWordsChange: (val: number) => void;
  extracting: boolean;
  canExtract: boolean;
  onExtract: () => void;
  generatingContent: boolean;
  onGenerate: () => void;
  modelConfigId?: string | null;
  onModelConfigIdChange?: (id: string | null) => void;
  isZenMode: boolean;
  onToggleZenMode: () => void;
  onOpenHistory: () => void;
  onOpenVerticalPreview: () => void;
  onOpenVoiceChecker: () => void;
  onOpenPersonaReview: () => void;
  onOpenProofread: () => void;
  onOpenChat?: () => void;
  onSave: () => void;
  isReferencePanelOpen?: boolean;
  onToggleReferencePanel?: () => void;
}

export function EditorToolbar({
  section,
  onUpdateTitle,
  wordCount,
  isDirty,
  saving,
  targetWords,
  onTargetWordsChange,
  extracting,
  canExtract,
  onExtract,
  generatingContent,
  onGenerate,
  modelConfigId,
  onModelConfigIdChange,
  isZenMode,
  onToggleZenMode,
  onOpenHistory,
  onOpenVerticalPreview,
  onOpenVoiceChecker,
  onOpenPersonaReview,
  onOpenProofread,
  onOpenChat,
  onSave,
  isReferencePanelOpen,
  onToggleReferencePanel,
}: EditorToolbarProps) {
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(section.title || `節 ${section.order}`);

  // ドロップダウン開閉ステート
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleInput(section.title || `節 ${section.order}`);
  }, [section.title, section.order]);

  // 外側クリックでメニューを閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setAiMenuOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveTitle = async () => {
    if (!titleInput.trim()) return;
    setIsEditingTitle(false);
    await onUpdateTitle(titleInput.trim());
  };

  // 読了目安時間（約400文字/分）
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 400));
  // 進捗率
  const progressPercent = Math.min(100, Math.round((wordCount / targetWords) * 100));

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-2.5 bg-surface">
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            {/* 節タイトルのインライン編集 */}
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={() => void handleSaveTitle()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveTitle();
                    if (e.key === 'Escape') {
                      setTitleInput(section.title || `節 ${section.order}`);
                      setIsEditingTitle(false);
                    }
                  }}
                  placeholder="節の名前を入力"
                  className="rounded border border-primary px-2 py-0.5 text-sm font-semibold text-foreground bg-background focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveTitle()}
                  className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground font-medium"
                >
                  決定
                </button>
              </div>
            ) : (
              <div className="group flex items-center gap-1.5">
                <h3
                  onClick={() => setIsEditingTitle(true)}
                  className="font-semibold text-foreground text-sm sm:text-base cursor-pointer hover:text-primary transition"
                  title="クリックして節の名前を変更"
                >
                  {section.title || `節 ${section.order}`}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition p-0.5"
                  title="節の名前を変更"
                >
                  <PencilIcon />
                </button>
              </div>
            )}

            {/* 保存ステータスバッジ */}
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
                saving
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : isDirty
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  saving ? 'bg-amber-500 animate-ping' : isDirty ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
              {saving ? '保存中...' : isDirty ? '未保存' : '保存完了'}
            </span>
          </div>

          {/* 文字数・進捗・読了目安 */}
          <div className="mt-0.5 flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
            <span>
              文字数: <strong className="text-foreground">{wordCount.toLocaleString()}</strong>
            </span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <span>目標:</span>
              {isEditingTarget ? (
                <input
                  type="number"
                  autoFocus
                  defaultValue={targetWords}
                  onBlur={(e) => onTargetWordsChange(parseInt(e.target.value, 10))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onTargetWordsChange(parseInt(e.currentTarget.value, 10));
                    }
                  }}
                  className="w-16 rounded border border-primary px-1 py-0.5 text-xs text-foreground bg-background"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingTarget(true)}
                  className="hover:underline hover:text-primary cursor-pointer"
                  title="クリックして目標文字数を変更"
                >
                  {targetWords.toLocaleString()} 字 ({progressPercent}%)
                </button>
              )}
            </div>
            <span>•</span>
            <span>読了目安: 約 {readingMinutes} 分</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* ✨ AI推敲・分析 ドロップダウン */}
        <div className="relative" ref={aiMenuRef}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setAiMenuOpen(!aiMenuOpen);
              setViewMenuOpen(false);
            }}
            rightIcon={<span className="text-[10px]">▼</span>}
          >
            ✨ AI推敲・分析
          </Button>

          {aiMenuOpen && (
            <div className="absolute right-0 mt-1 w-56 rounded-xl border border-border bg-surface shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 divide-y divide-border/40">
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setAiMenuOpen(false);
                    onOpenProofread();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-foreground hover:bg-surface-raised transition cursor-pointer text-left"
                >
                  <span className="text-base">✨</span>
                  <div>
                    <div className="font-semibold">本文校正・推敲</div>
                    <div className="text-[10px] text-muted-foreground">
                      誤字・文体・視点ブレを点検
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAiMenuOpen(false);
                    onOpenVoiceChecker();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-foreground hover:bg-surface-raised transition cursor-pointer text-left"
                >
                  <span className="text-base">🎭</span>
                  <div>
                    <div className="font-semibold">口調・一貫性チェック</div>
                    <div className="text-[10px] text-muted-foreground">
                      人物設定とセリフのズレを検出
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAiMenuOpen(false);
                    onOpenPersonaReview();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-foreground hover:bg-surface-raised transition cursor-pointer text-left"
                >
                  <span className="text-base">👥</span>
                  <div>
                    <div className="font-semibold">4ペルソナ模擬査読</div>
                    <div className="text-[10px] text-muted-foreground">
                      編集者・読者・評論家レビュー
                    </div>
                  </div>
                </button>

                {onOpenChat && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiMenuOpen(false);
                      onOpenChat();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-foreground hover:bg-surface-raised transition cursor-pointer text-left"
                  >
                    <span className="text-base">💬</span>
                    <div>
                      <div className="font-semibold">チャットで相談・壁打ち</div>
                      <div className="text-[10px] text-muted-foreground">
                        この話の展開や設定をAIと相談
                      </div>
                    </div>
                  </button>
                )}
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setAiMenuOpen(false);
                    onExtract();
                  }}
                  disabled={!canExtract || extracting}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-foreground hover:bg-surface-raised transition cursor-pointer text-left disabled:opacity-50"
                >
                  <span className="text-base">⚡</span>
                  <div>
                    <div className="font-semibold">
                      {extracting ? '抽出中...' : '整合性更新（設定抽出）'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      本文から新設定・年表を抽出
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 👁️ 表示・履歴 ドロップダウン */}
        <div className="relative" ref={viewMenuRef}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setViewMenuOpen(!viewMenuOpen);
              setAiMenuOpen(false);
            }}
            rightIcon={<span className="text-[10px]">▼</span>}
          >
            👁️ 表示
          </Button>

          {viewMenuOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-xl border border-border bg-surface shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setViewMenuOpen(false);
                  onOpenVerticalPreview();
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-foreground hover:bg-surface-raised transition cursor-pointer text-left"
              >
                <span>📖</span>
                <span>縦書きプレビュー</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMenuOpen(false);
                  onOpenHistory();
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-foreground hover:bg-surface-raised transition cursor-pointer text-left"
              >
                <span>🕒</span>
                <span>編集履歴・差分比較</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMenuOpen(false);
                  onToggleZenMode();
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-foreground hover:bg-surface-raised transition cursor-pointer text-left"
              >
                <span>{isZenMode ? '✕' : '⛶'}</span>
                <span>{isZenMode ? '集中モード解除 (Esc)' : '全画面集中モード'}</span>
              </button>
            </div>
          )}
        </div>

        {/* 📑 参考資料ペイン開閉トグル */}
        {onToggleReferencePanel && (
          <Button
            size="sm"
            variant={isReferencePanelOpen ? 'primary' : 'secondary'}
            onClick={onToggleReferencePanel}
            title="エディタ横にプロット・人物・設定を常時表示"
          >
            📑 参考資料
          </Button>
        )}

        {/* モデル選択 */}
        {onModelConfigIdChange && (
          <LLMModelSelector value={modelConfigId} onChange={onModelConfigIdChange} size="sm" />
        )}

        {/* 本文生成 */}
        <Button
          size="sm"
          variant="secondary"
          onClick={onGenerate}
          isLoading={generatingContent}
          leftIcon={<SparklesIcon />}
        >
          本文生成
        </Button>

        {/* 保存ボタン */}
        <Button
          size="sm"
          variant="primary"
          onClick={onSave}
          isLoading={saving}
          disabled={!isDirty}
          title="Ctrl + S でも保存できます"
        >
          保存
        </Button>
      </div>
    </header>
  );
}
