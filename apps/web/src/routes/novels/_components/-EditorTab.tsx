import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button.js';
import { Loading } from '@/components/Loading.js';
import { Modal } from '@/components/Modal.js';
import { useChapters } from '@/hooks/useChapters.js';
import { useContent } from '@/hooks/useContent.js';
import { useGenerate } from '@/hooks/useGenerate.js';
import { useNovel } from '@/hooks/useNovel.js';
import { useToast } from '@/hooks/useToast.js';
import { countWords } from '@/lib/sse.js';
import type { ExtractResult, Section, Setting, Timeline } from '@/lib/types.js';
import { HistoryDiffModal } from '@/components/HistoryDiffModal.js';
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, SparklesIcon } from './-Icons.js';
import { MonacoEditor } from './-MonacoEditor.js';

export function EditorTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const { chapters, createSection, updateSection, creating } = useChapters(novel.id);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(new Set());
  const [editorKey, setEditorKey] = useState(0);
  const [isZenMode, setIsZenMode] = useState(false);

  // ドラッグ＆ドロップ用ステート
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);

  // 初期ロード時に全章を展開し、最初の節を選択
  useEffect(() => {
    if (chapters.length > 0) {
      if (expandedChapterIds.size === 0) {
        setExpandedChapterIds(new Set(chapters.map((c) => c.id)));
      }
      if (!selectedChapterId) {
        setSelectedChapterId(chapters[0].id);
        const firstSec = chapters[0].sections[0];
        if (firstSec) {
          setSelectedSectionId(firstSec.id);
        }
      }
    }
  }, [chapters, selectedChapterId, expandedChapterIds.size]);

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

  const toggleChapterExpand = (chapterId: string) => {
    setExpandedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const handleAddSection = async (chapterId: string) => {
    const targetChapter = chapters.find((c) => c.id === chapterId);
    const nextOrder = (targetChapter?.sections.length ?? 0) + 1;
    const newSec = await createSection(chapterId, {
      title: `節 ${nextOrder}`,
      order: nextOrder,
      summary: '',
    });
    setSelectedChapterId(chapterId);
    setSelectedSectionId(newSec.id);
    setExpandedChapterIds((prev) => new Set([...prev, chapterId]));
    setEditorKey((k) => k + 1);
    await onRefresh();
  };

  const handleUpdateSectionTitle = async (section: Section, newTitle: string) => {
    await updateSection(section.id, {
      title: newTitle.trim(),
      order: section.order,
      summary: section.summary ?? '',
    });
    await onRefresh();
  };

  // ドラッグ＆ドロップハンドラ
  const handleDragStart = (e: React.DragEvent, sectionId: string) => {
    e.dataTransfer.setData('text/plain', sectionId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingSectionId(sectionId);
  };

  const handleDragOver = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingSectionId === targetSectionId) {
      setDragOverSectionId(null);
      setDragOverPosition(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const pos = e.clientY < mid ? 'before' : 'after';
    setDragOverSectionId(targetSectionId);
    setDragOverPosition(pos);
  };

  const handleDragEnd = () => {
    setDraggingSectionId(null);
    setDragOverSectionId(null);
    setDragOverPosition(null);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetChapterId: string,
    targetSectionId: string,
  ) => {
    e.preventDefault();
    const sourceSectionId = e.dataTransfer.getData('text/plain') || draggingSectionId;
    setDraggingSectionId(null);
    setDragOverSectionId(null);
    setDragOverPosition(null);

    if (!sourceSectionId || sourceSectionId === targetSectionId) return;

    const targetChapter = chapters.find((c) => c.id === targetChapterId);
    if (!targetChapter) return;

    // 移動対象の節を取得
    let sourceSection: Section | undefined;
    for (const c of chapters) {
      sourceSection = c.sections.find((s) => s.id === sourceSectionId);
      if (sourceSection) break;
    }
    if (!sourceSection) return;

    // 同一章内の並び替え
    const remaining = targetChapter.sections.filter((s) => s.id !== sourceSectionId);
    const targetIdx = remaining.findIndex((s) => s.id === targetSectionId);
    if (targetIdx === -1) return;

    const insertIdx = dragOverPosition === 'after' ? targetIdx + 1 : targetIdx;
    remaining.splice(insertIdx, 0, sourceSection);

    // 順序（order）を更新
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const newOrder = i + 1;
      if (s.order !== newOrder) {
        await updateSection(s.id, {
          title: s.title ?? '',
          order: newOrder,
          summary: s.summary ?? '',
        });
      }
    }

    await onRefresh();
  };

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const selectedSection = selectedChapter?.sections.find((s) => s.id === selectedSectionId);

  return (
    <div
      className={
        isZenMode
          ? 'fixed inset-0 z-50 flex flex-col bg-background p-6'
          : 'flex h-full w-full gap-4 min-h-0 overflow-hidden'
      }
    >
      {!isZenMode && (
        <aside className="w-72 shrink-0 h-full overflow-y-auto rounded-xl border border-border bg-surface p-3 flex flex-col">
          <div className="mb-3 flex items-center justify-between px-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              章 / 節 一覧
            </h3>
            <span className="text-[11px] text-muted-foreground">{chapters.length} 章</span>
          </div>

          {chapters.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">
              章がありません。プロットタブから章を作成してください。
            </p>
          ) : (
            <div className="flex-1 space-y-2 pr-1">
              {chapters.map((chapter) => {
                const isExpanded = expandedChapterIds.has(chapter.id);
                const hasSections = chapter.sections.length > 0;
                const isSelectedChapter = chapter.id === selectedChapterId;

                return (
                  <div
                    key={chapter.id}
                    className={`rounded-lg border transition ${
                      isSelectedChapter
                        ? 'border-primary/40 bg-surface-raised/60'
                        : 'border-border/60 bg-surface'
                    }`}
                  >
                    {/* 章ヘッダー */}
                    <div className="flex items-center justify-between p-2">
                      <button
                        type="button"
                        onClick={() => {
                          toggleChapterExpand(chapter.id);
                          setSelectedChapterId(chapter.id);
                        }}
                        className="flex flex-1 items-center gap-1.5 text-left text-xs font-semibold text-foreground hover:text-primary transition min-w-0"
                      >
                        <span className="text-muted-foreground shrink-0">
                          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </span>
                        <span className="truncate">{chapter.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAddSection(chapter.id)}
                        disabled={creating}
                        className="ml-1 rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-primary transition shrink-0"
                        title="この章に節を追加"
                      >
                        <PlusIcon />
                      </button>
                    </div>

                    {/* 節一覧（ドラッグ＆ドロップ対応） */}
                    {isExpanded && hasSections && (
                      <div className="border-t border-border/40 px-2 py-1.5 space-y-1">
                        {chapter.sections.map((section) => {
                          const isSelected = selectedSectionId === section.id;
                          const isDragging = draggingSectionId === section.id;
                          const isDragOver = dragOverSectionId === section.id;

                          return (
                            <div
                              key={section.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, section.id)}
                              onDragOver={(e) => handleDragOver(e, section.id)}
                              onDragEnd={handleDragEnd}
                              onDrop={(e) => void handleDrop(e, chapter.id, section.id)}
                              className={`group relative flex items-center gap-1 rounded px-1.5 py-1 text-xs transition cursor-pointer select-none ${
                                isDragging ? 'opacity-30' : ''
                              } ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                  : 'text-foreground hover:bg-surface-hover'
                              } ${
                                isDragOver && dragOverPosition === 'before'
                                  ? 'border-t-2 border-primary'
                                  : ''
                              } ${
                                isDragOver && dragOverPosition === 'after'
                                  ? 'border-b-2 border-primary'
                                  : ''
                              }`}
                              onClick={() => {
                                setSelectedChapterId(chapter.id);
                                setSelectedSectionId(section.id);
                                setEditorKey((k) => k + 1);
                              }}
                            >
                              {/* ドラッグハンドル */}
                              <span
                                className={`shrink-0 cursor-grab opacity-40 group-hover:opacity-100 transition ${
                                  isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                                }`}
                                title="ドラッグして順序を入れ替え"
                              >
                                <GripVerticalIcon />
                              </span>

                              <span className="flex-1 truncate">
                                {section.title || `節 ${section.order}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      )}

      <main
        className={`flex min-w-0 flex-1 h-full flex-col rounded-xl border border-border bg-surface overflow-hidden shadow-sm ${
          isZenMode ? 'mx-auto w-full max-w-4xl' : ''
        }`}
      >
        {selectedSection ? (
          <SectionEditor
            key={editorKey}
            novelId={novel.id}
            section={selectedSection}
            onRefresh={onRefresh}
            onUpdateTitle={(newTitle) => handleUpdateSectionTitle(selectedSection, newTitle)}
            isZenMode={isZenMode}
            onToggleZenMode={() => setIsZenMode((prev) => !prev)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="text-4xl">✍️</div>
            <div>
              <h3 className="font-semibold text-foreground text-base">
                {selectedChapter
                  ? `「${selectedChapter.title}」が選択されています`
                  : '執筆する節を選択してください'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                左側のサイドバーから執筆したい節を選択するか、新しく節を追加して執筆を開始しましょう。
              </p>
            </div>
            {selectedChapter && (
              <Button
                variant="primary"
                onClick={() => void handleAddSection(selectedChapter.id)}
                disabled={creating}
                leftIcon={<PlusIcon />}
              >
                この章に節を追加して執筆開始
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SectionEditor({
  novelId,
  section,
  onRefresh,
  onUpdateTitle,
  isZenMode,
  onToggleZenMode,
}: {
  novelId: string;
  section: Section;
  onRefresh: () => Promise<void>;
  onUpdateTitle: (newTitle: string) => Promise<void>;
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(section.title || `節 ${section.order}`);
  const [extractResultOpen, setExtractResultOpen] = useState(false);
  const [extracted, setExtracted] = useState<ExtractResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setTitleInput(section.title || `節 ${section.order}`);
  }, [section.title, section.order]);

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
    try {
      await updateContent(localBody);
      setSavedBody(localBody);
      await onRefresh();
      toast.success('本文を保存しました');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '本文の保存に失敗しました');
    }
  }, [isDirty, localBody, onRefresh, saving, toast, updateContent]);

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

  const handleSaveTitle = async () => {
    if (!titleInput.trim()) return;
    setIsEditingTitle(false);
    await onUpdateTitle(titleInput.trim());
  };

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
    <div className="flex h-full w-full flex-col min-h-0 overflow-hidden">
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
            onClick={() => setHistoryOpen(true)}
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
      <div className="h-1 w-full bg-border shrink-0">
        <div
          className={`h-full transition-all duration-300 ${
            progressPercent >= 100 ? 'bg-emerald-500' : 'bg-primary'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {loading ? (
          <Loading message="本文を読み込み中..." />
        ) : (
          <MonacoEditor value={localBody} onChange={setLocalBody} />
        )}
      </div>

      {generatingContent && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-5 py-2 text-xs text-primary bg-surface">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
          本文をストリーミング生成中…
        </div>
      )}
      {streamError && (
        <div className="shrink-0 border-t border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">
          {streamError}
        </div>
      )}
      <ExtractResultModal
        isOpen={extractResultOpen}
        onClose={() => setExtractResultOpen(false)}
        result={extracted}
      />
      <HistoryDiffModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        novelId={novelId}
        entityType="content"
        entityId={section.id}
        currentContent={localBody}
        title={`${section.title || `節 ${section.order}`} の本文`}
        onRestoreSuccess={(restored) => {
          setLocalBody(restored);
          setSavedBody(restored);
          toast.success('過去のバージョンから本文を復元しました');
          void onRefresh();
        }}
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

function GripVerticalIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5"
    >
      <path d="M7 2a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm6-12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}
