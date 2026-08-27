import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button.js';
import { Loading } from '@/components/Loading.js';
import { Modal } from '@/components/Modal.js';
import { useChapters } from '@/hooks/useChapters.js';
import { useContent } from '@/hooks/useContent.js';
import { useGenerate } from '@/hooks/useGenerate.js';
import { useNovel } from '@/hooks/useNovel.js';
import { countWords } from '@/lib/sse.js';
import type { ExtractResult, Section, Setting, Timeline } from '@/lib/types.js';
import { SparklesIcon } from './-Icons.js';
import { MonacoEditor } from './-MonacoEditor.js';

export function EditorTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const { chapters } = useChapters(novel.id);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [isZenMode, setIsZenMode] = useState(false);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const selectedSection = selectedChapter?.sections.find((s) => s.id === selectedSectionId);

  useEffect(() => {
    if (chapters.length > 0 && !selectedChapterId) {
      setSelectedChapterId(chapters[0].id);
      setSelectedSectionId(chapters[0].sections[0]?.id ?? null);
    }
  }, [chapters, selectedChapterId]);

  // ESC キーで全画面モードを解除
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZenMode) {
        setIsZenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode]);

  return (
    <div
      className={
        isZenMode
          ? 'fixed inset-0 z-50 flex flex-col bg-background p-6'
          : 'flex h-[calc(100vh-12rem)] gap-4'
      }
    >
      {!isZenMode && (
        <aside className="w-64 shrink-0 overflow-auto rounded-xl border border-border bg-surface p-3">
          <h3 className="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            章 / 節
          </h3>
          {chapters.length === 0 && (
            <p className="px-2 text-sm text-muted-foreground">章がありません。</p>
          )}
          {chapters.map((chapter) => (
            <div key={chapter.id} className="mb-2">
              <div className="px-2 py-1 text-sm font-semibold text-foreground">{chapter.title}</div>
              {chapter.sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setSelectedChapterId(chapter.id);
                    setSelectedSectionId(section.id);
                    setEditorKey((k) => k + 1);
                  }}
                  className={`block w-full rounded px-2 py-1 text-left text-sm transition ${
                    selectedSectionId === section.id
                      ? 'bg-primary/10 text-primary font-medium dark:bg-primary/20'
                      : 'text-foreground/80 hover:bg-surface-hover'
                  }`}
                >
                  {section.title || `節 ${section.order}`}
                </button>
              ))}
            </div>
          ))}
        </aside>
      )}

      <main
        className={`flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-surface shadow-sm ${
          isZenMode ? 'mx-auto w-full max-w-4xl h-full' : ''
        }`}
      >
        {selectedSection ? (
          <SectionEditor
            key={editorKey}
            section={selectedSection}
            onRefresh={onRefresh}
            isZenMode={isZenMode}
            onToggleZenMode={() => setIsZenMode((prev) => !prev)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            節を選択してください
          </div>
        )}
      </main>
    </div>
  );
}

function SectionEditor({
  section,
  onRefresh,
  isZenMode,
  onToggleZenMode,
}: {
  section: Section;
  onRefresh: () => Promise<void>;
  isZenMode: boolean;
  onToggleZenMode: () => void;
}) {
  const { content, loading, saving, updateContent } = useContent(section.id);
  const { generateContent, generatingContent, extract, extracting, streamError, resetStreamError } =
    useGenerate();
  const [localBody, setLocalBody] = useState('');
  const [savedBody, setSavedBody] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [targetWords, setTargetWords] = useState(() => {
    const saved = localStorage.getItem(`novel-creator:target-words:${section.id}`);
    return saved ? parseInt(saved, 10) : 2000;
  });
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [extractResultOpen, setExtractResultOpen] = useState(false);
  const [extracted, setExtracted] = useState<ExtractResult | null>(null);

  useEffect(() => {
    if (content) {
      setLocalBody(content.body);
      setSavedBody(content.body);
      setWordCount(content.wordCount ?? countWords(content.body));
    }
  }, [content]);

  useEffect(() => {
    setWordCount(countWords(localBody));
  }, [localBody]);

  const isDirty = localBody !== savedBody;

  const handleSave = useCallback(async () => {
    if (!isDirty && !saving) return;
    await updateContent(localBody);
    setSavedBody(localBody);
    await onRefresh();
  }, [isDirty, localBody, onRefresh, saving, updateContent]);

  // Ctrl+S / Cmd+S ショートカットで保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const handleTargetWordsChange = (val: number) => {
    const clamped = Math.max(100, Math.min(50000, isNaN(val) ? 2000 : val));
    setTargetWords(clamped);
    localStorage.setItem(`novel-creator:target-words:${section.id}`, String(clamped));
    setIsEditingTarget(false);
  };

  async function handleGenerate() {
    resetStreamError();
    let accumulated = localBody;
    await generateContent(section.id, (chunk) => {
      accumulated += chunk;
      setLocalBody(accumulated);
    });
    await updateContent(accumulated);
    setSavedBody(accumulated);
  }

  async function handleExtract() {
    if (!localBody.trim()) return;
    const result = await extract(section.id);
    setExtracted(result);
    setExtractResultOpen(true);
  }

  // 読了目安時間（約400文字/分）
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 400));
  // 進捗率
  const progressPercent = Math.min(100, Math.round((wordCount / targetWords) * 100));

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 bg-surface">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-base">
                {section.title || `節 ${section.order}`}
              </h3>
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
                    saving
                      ? 'bg-amber-500 animate-ping'
                      : isDirty
                        ? 'bg-rose-500'
                        : 'bg-emerald-500'
                  }`}
                />
                {saving ? '保存中...' : isDirty ? '未保存' : '保存完了'}
              </span>
            </div>

            {/* 文字数・進捗・読了目安 */}
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                文字数: <strong className="text-foreground">{wordCount.toLocaleString()}</strong>
              </span>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <span>目標:</span>
                {isEditingTarget ? (
                  <input
                    type="number"
                    autoFocus
                    defaultValue={targetWords}
                    onBlur={(e) => handleTargetWordsChange(parseInt(e.target.value, 10))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleTargetWordsChange(parseInt(e.currentTarget.value, 10));
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
            onClick={onToggleZenMode}
            title={isZenMode ? '集中モードを解除 (Esc)' : '全画面集中モード'}
          >
            {isZenMode ? '✕ 集中モード解除' : '⛶ 集中モード'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExtract}
            isLoading={extracting}
            disabled={!localBody.trim()}
          >
            整合性更新
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGenerate}
            isLoading={generatingContent}
            leftIcon={<SparklesIcon />}
          >
            本文生成
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            isLoading={saving}
            disabled={!isDirty}
            title="Ctrl + S でも保存できます"
          >
            保存
          </Button>
        </div>
      </header>

      {/* 目標達成度プログレスバー */}
      <div className="h-1 w-full bg-border">
        <div
          className={`h-full transition-all duration-300 ${
            progressPercent >= 100 ? 'bg-emerald-500' : 'bg-primary'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <Loading message="本文を読み込み中..." />
        ) : (
          <MonacoEditor value={localBody} onChange={setLocalBody} />
        )}
      </div>

      {generatingContent && (
        <div className="flex items-center gap-2 border-t border-border px-5 py-2 text-xs text-primary bg-surface">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
          本文をストリーミング生成中…
        </div>
      )}
      {streamError && (
        <div className="border-t border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">
          {streamError}
        </div>
      )}
      <ExtractResultModal
        isOpen={extractResultOpen}
        onClose={() => setExtractResultOpen(false)}
        result={extracted}
      />
    </div>
  );
}

function ExtractResultModal({
  isOpen,
  onClose,
  result,
}: {
  isOpen: boolean;
  onClose: () => void;
  result: ExtractResult | null;
}) {
  if (!result) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="整合性更新結果"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">抽出された時系列</h4>
          {result.timelines.length === 0 ? (
            <p className="text-sm text-muted-foreground">ありません</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {result.timelines.map((timeline: Timeline) => (
                <li
                  key={timeline.id}
                  className="rounded bg-surface-raised px-3 py-2 border border-border"
                >
                  {timeline.timestamp && (
                    <span className="mr-2 text-xs text-muted-foreground">{timeline.timestamp}</span>
                  )}
                  {timeline.event}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">抽出された設定</h4>
          {result.settings.length === 0 ? (
            <p className="text-sm text-muted-foreground">ありません</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {result.settings.map((setting: Setting) => (
                <li
                  key={setting.id}
                  className="rounded bg-surface-raised px-3 py-2 border border-border"
                >
                  <span className="text-xs font-bold uppercase text-primary">
                    {setting.category}
                  </span>
                  <div className="font-medium text-foreground">{setting.name}</div>
                  <div className="text-sm text-muted-foreground">{setting.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
