import { useEffect, useState } from 'react';
import { Button } from '@/components/Button.js';
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
  isZenMode: boolean;
  onToggleZenMode: () => void;
  onOpenHistory: () => void;
  onSave: () => void;
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
  isZenMode,
  onToggleZenMode,
  onOpenHistory,
  onSave,
}: EditorToolbarProps) {
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(section.title || `節 ${section.order}`);

  useEffect(() => {
    setTitleInput(section.title || `節 ${section.order}`);
  }, [section.title, section.order]);

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
        <Button
          size="sm"
          variant="secondary"
          onClick={onOpenHistory}
          title="編集履歴と差分を確認・復元"
        >
          🕒 履歴
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onToggleZenMode}
          title={isZenMode ? '集中モードを解除 (Esc)' : '全画面集中モード'}
        >
          {isZenMode ? '✕ 集中モード解除' : '⛶ 集中モード'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onExtract}
          isLoading={extracting}
          disabled={!canExtract}
        >
          整合性更新
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onGenerate}
          isLoading={generatingContent}
          leftIcon={<SparklesIcon />}
        >
          本文生成
        </Button>
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
