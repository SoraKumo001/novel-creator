import { useEffect, useState } from 'react';
import { Button } from '@/components/Button.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { EmptyState } from '@/components/EmptyState.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { Modal } from '@/components/Modal.js';
import { Textarea } from '@/components/Textarea.js';
import { useChapters } from '@/hooks/useChapters.js';
import { useGenerate } from '@/hooks/useGenerate.js';
import { useNovel } from '@/hooks/useNovel.js';
import type { Chapter, Section } from '@/lib/types.js';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from './-Icons.js';

export function PlotTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const {
    chapters,
    loading,
    refetch: refetchChapters,
    createChapter,
    updateChapter,
    deleteChapter,
    createSection,
    updateSection,
    deleteSection,
    creating,
    updating,
    deleting,
  } = useChapters(novel.id);
  const {
    generatePlot,
    generateChapterSummary,
    generateSectionSummary,
    generatingPlot,
    generatedPlot,
    resetGeneratedPlot,
  } = useGenerate();

  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(new Set());
  const [chapterForm, setChapterForm] = useState<Chapter | null>(null);
  const [sectionForm, setSectionForm] = useState<{ chapterId: string; section?: Section } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'chapter' | 'section';
    id: string;
  } | null>(null);

  const [plotPreview, setPlotPreview] = useState(generatedPlot);
  const [selectedPlotIndices, setSelectedPlotIndices] = useState<Set<number>>(new Set());
  const [activeGeneratingId, setActiveGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    if (generatedPlot) {
      setPlotPreview(generatedPlot);
      setSelectedPlotIndices(new Set(generatedPlot.chapters.map((_, i) => i)));
    }
  }, [generatedPlot]);

  async function handleGeneratePlot() {
    resetGeneratedPlot();
    const plot = await generatePlot(novel.id);
    setPlotPreview(plot);
    setSelectedPlotIndices(new Set(plot.chapters.map((_, i) => i)));
  }

  async function handleApplyPlot() {
    if (!plotPreview) return;
    const selectedChapters = plotPreview.chapters.filter((_, i) => selectedPlotIndices.has(i));
    for (const ch of selectedChapters) {
      await createChapter({ title: ch.title, order: ch.order, summary: ch.summary });
    }
    setPlotPreview(null);
    setSelectedPlotIndices(new Set());
    await refetchChapters();
    await onRefresh();
  }

  const toggleExpandAll = () => {
    if (expandedChapterIds.size === chapters.length) {
      setExpandedChapterIds(new Set());
    } else {
      setExpandedChapterIds(new Set(chapters.map((c) => c.id)));
    }
  };

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

  async function handleSaveChapter(input: { title: string; order: number; summary: string }) {
    if (chapterForm) {
      await updateChapter(chapterForm.id, input);
    } else {
      await createChapter(input);
    }
    setChapterForm(null);
    await refetchChapters();
    await onRefresh();
  }

  async function handleSaveSection(input: { title: string; order: number; summary: string }) {
    if (!sectionForm) return;
    if (sectionForm.section) {
      await updateSection(sectionForm.section.id, input);
    } else {
      await createSection(sectionForm.chapterId, input);
    }
    setSectionForm(null);
    await refetchChapters();
    await onRefresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'chapter') {
      await deleteChapter(deleteTarget.id);
    } else {
      await deleteSection(deleteTarget.id);
    }
    setDeleteTarget(null);
    await refetchChapters();
    await onRefresh();
  }

  async function handleGenerateChapterSummaryAction(chapterId: string) {
    setActiveGeneratingId(chapterId);
    try {
      await generateChapterSummary(chapterId);
      await refetchChapters();
      await onRefresh();
    } finally {
      setActiveGeneratingId(null);
    }
  }

  async function handleGenerateSectionSummaryAction(sectionId: string) {
    setActiveGeneratingId(sectionId);
    try {
      await generateSectionSummary(sectionId);
      await refetchChapters();
      await onRefresh();
    } finally {
      setActiveGeneratingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground">章立て・プロット</h2>
          {chapters.length > 0 && (
            <button
              onClick={toggleExpandAll}
              className="text-xs text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              {expandedChapterIds.size === chapters.length ? 'すべて折りたたむ' : 'すべて展開'}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleGeneratePlot}
            isLoading={generatingPlot}
            leftIcon={<SparklesIcon />}
          >
            プロット生成
          </Button>
          <Button onClick={() => setChapterForm({} as Chapter)} leftIcon={<PlusIcon />}>
            章を追加
          </Button>
        </div>
      </div>

      {plotPreview && (
        <div className="rounded-xl border border-primary/40 bg-surface-raised p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-foreground text-base">生成されたプロット案</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                チェックを入れた章を一括で章立て一覧に反映します。
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPlotPreview(null);
                  setSelectedPlotIndices(new Set());
                }}
              >
                破棄
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleApplyPlot}
                disabled={selectedPlotIndices.size === 0}
              >
                選択した {selectedPlotIndices.size} 章を適用
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
              <input
                type="checkbox"
                checked={
                  selectedPlotIndices.size === plotPreview.chapters.length &&
                  plotPreview.chapters.length > 0
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedPlotIndices(new Set(plotPreview.chapters.map((_, i) => i)));
                  } else {
                    setSelectedPlotIndices(new Set());
                  }
                }}
                className="rounded text-primary focus:ring-primary"
              />
              すべて選択 / 解除
            </label>
            <span>合計 {plotPreview.chapters.length} 章</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {plotPreview.chapters.map((ch, idx) => {
              const isChecked = selectedPlotIndices.has(idx);
              return (
                <label
                  key={idx}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
                    isChecked
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-xs'
                      : 'border-border bg-surface hover:bg-surface-hover/50 opacity-70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      setSelectedPlotIndices((prev) => {
                        const next = new Set(prev);
                        if (next.has(idx)) next.delete(idx);
                        else next.add(idx);
                        return next;
                      });
                    }}
                    className="mt-0.5 rounded text-primary focus:ring-primary"
                  />
                  <div className="text-sm">
                    <span className="font-semibold text-foreground">
                      第 {ch.order} 章: {ch.title}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {ch.summary}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {loading && <Loading message="章を読み込み中..." />}
      {!loading && chapters.length === 0 && (
        <EmptyState
          title="章がありません"
          description="章を追加するか、プロット生成から始めましょう。"
        />
      )}

      {!loading && (
        <div className="space-y-3">
          {chapters.map((chapter) => (
            <ChapterTreeItem
              key={chapter.id}
              chapter={chapter}
              isExpanded={expandedChapterIds.has(chapter.id)}
              onToggle={() => toggleChapterExpand(chapter.id)}
              onEditChapter={() => setChapterForm(chapter)}
              onDeleteChapter={() => setDeleteTarget({ type: 'chapter', id: chapter.id })}
              onGenerateChapterSummary={() => handleGenerateChapterSummaryAction(chapter.id)}
              onAddSection={() => setSectionForm({ chapterId: chapter.id })}
              onEditSection={(s) => setSectionForm({ chapterId: chapter.id, section: s })}
              onDeleteSection={(s) => setDeleteTarget({ type: 'section', id: s.id })}
              onGenerateSectionSummary={(s) => handleGenerateSectionSummaryAction(s.id)}
              generatingSummaryId={activeGeneratingId}
            />
          ))}
        </div>
      )}

      <ChapterFormModal
        isOpen={!!chapterForm}
        onClose={() => setChapterForm(null)}
        onSubmit={handleSaveChapter}
        isLoading={chapterForm ? updating : creating}
        title={chapterForm ? '章を編集' : '章を追加'}
        defaultValues={chapterForm ?? undefined}
      />
      <SectionFormModal
        isOpen={!!sectionForm}
        onClose={() => setSectionForm(null)}
        onSubmit={handleSaveSection}
        isLoading={sectionForm?.section ? updating : creating}
        title={sectionForm?.section ? '節を編集' : '節を追加'}
        defaultValues={sectionForm?.section}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.type === 'chapter' ? '章を削除しますか？' : '節を削除しますか？'}
        message="紐づく本文や時系列も削除されます。"
        confirmLabel="削除"
        isLoading={deleting}
      />
    </div>
  );
}

function ChapterTreeItem({
  chapter,
  isExpanded,
  onToggle,
  onEditChapter,
  onDeleteChapter,
  onGenerateChapterSummary,
  onAddSection,
  onEditSection,
  onDeleteSection,
  onGenerateSectionSummary,
  generatingSummaryId,
}: {
  chapter: Chapter & { sections: Section[] };
  isExpanded: boolean;
  onToggle: () => void;
  onEditChapter: () => void;
  onDeleteChapter: () => void;
  onGenerateChapterSummary: () => Promise<void>;
  onAddSection: () => void;
  onEditSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
  onGenerateSectionSummary: (section: Section) => Promise<void>;
  generatingSummaryId: string | null;
}) {
  const isGeneratingChapter = generatingSummaryId === chapter.id;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface-hover/50 transition">
        <div
          className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0"
          onClick={onToggle}
        >
          <button type="button" className="text-muted-foreground hover:text-foreground">
            {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
          <div className="truncate">
            <span className="font-semibold text-foreground mr-2">
              第 {chapter.order} 章: {chapter.title}
            </span>
            <span className="text-xs text-muted-foreground">({chapter.sections.length} 節)</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            label={isGeneratingChapter ? '概要を生成中...' : 'AIで章の概要を生成'}
            icon={
              isGeneratingChapter ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent inline-block" />
              ) : (
                <SparklesIcon />
              )
            }
            onClick={() => void onGenerateChapterSummary()}
            disabled={!!generatingSummaryId}
          />
          <IconButton label="節を追加" icon={<PlusIcon />} onClick={onAddSection} />
          <IconButton label="章を編集" icon={<PencilIcon />} onClick={onEditChapter} />
          <IconButton label="章を削除" icon={<TrashIcon />} onClick={onDeleteChapter} />
        </div>
      </div>

      {chapter.summary && (
        <div className="px-5 py-2.5 text-xs text-muted-foreground border-t border-border bg-surface-raised/40 leading-relaxed">
          {chapter.summary}
        </div>
      )}

      {isExpanded && (
        <div className="border-t border-border bg-surface-raised/20 p-3 space-y-2">
          {chapter.sections.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground italic">節がまだありません。</p>
          ) : (
            chapter.sections.map((section) => {
              const isGeneratingSec = generatingSummaryId === section.id;
              return (
                <div
                  key={section.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground text-sm">
                      節 {section.order}: {section.title || '（無題）'}
                    </div>
                    {section.summary ? (
                      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {section.summary}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground/60 mt-0.5 italic">
                        概要なし（✨ 概要生成ボタンでAIにあらすじを考えてもらえます）
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <IconButton
                      label={isGeneratingSec ? '概要を生成中...' : 'AIで節の概要を生成'}
                      icon={
                        isGeneratingSec ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent inline-block" />
                        ) : (
                          <SparklesIcon />
                        )
                      }
                      onClick={() => void onGenerateSectionSummary(section)}
                      disabled={!!generatingSummaryId}
                    />
                    <IconButton
                      label="節を編集"
                      icon={<PencilIcon />}
                      onClick={() => onEditSection(section)}
                    />
                    <IconButton
                      label="節を削除"
                      icon={<TrashIcon />}
                      onClick={() => onDeleteSection(section)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function ChapterFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  title,
  defaultValues,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: { title: string; order: number; summary: string }) => Promise<void>;
  isLoading: boolean;
  title: string;
  defaultValues?: Chapter;
}) {
  const [chapterTitle, setChapterTitle] = useState(defaultValues?.title ?? '');
  const [order, setOrder] = useState(defaultValues?.order ?? 1);
  const [summary, setSummary] = useState(defaultValues?.summary ?? '');

  useEffect(() => {
    if (defaultValues) {
      setChapterTitle(defaultValues.title);
      setOrder(defaultValues.order);
      setSummary(defaultValues.summary ?? '');
    } else {
      setChapterTitle('');
      setOrder(1);
      setSummary('');
    }
  }, [defaultValues]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={() => onSubmit({ title: chapterTitle, order, summary })}
            isLoading={isLoading}
            disabled={!chapterTitle.trim()}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="章タイトル"
          value={chapterTitle}
          onChange={(e) => setChapterTitle(e.target.value)}
          placeholder="第一章 冒険の始まり"
        />
        <Input
          label="順序"
          type="number"
          value={String(order)}
          onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
        />
        <Textarea
          label="章の概要 / あらすじ"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="この章で何が起きるか、主要な展開など"
          rows={4}
        />
      </div>
    </Modal>
  );
}

function SectionFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  title,
  defaultValues,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: { title: string; order: number; summary: string }) => Promise<void>;
  isLoading: boolean;
  title: string;
  defaultValues?: Section;
}) {
  const [sectionTitle, setSectionTitle] = useState(defaultValues?.title ?? '');
  const [order, setOrder] = useState(defaultValues?.order ?? 1);
  const [summary, setSummary] = useState(defaultValues?.summary ?? '');

  useEffect(() => {
    if (defaultValues) {
      setSectionTitle(defaultValues.title ?? '');
      setOrder(defaultValues.order);
      setSummary(defaultValues.summary ?? '');
    } else {
      setSectionTitle('');
      setOrder(1);
      setSummary('');
    }
  }, [defaultValues]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={() => onSubmit({ title: sectionTitle, order, summary })}
            isLoading={isLoading}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="節タイトル"
          value={sectionTitle}
          onChange={(e) => setSectionTitle(e.target.value)}
          placeholder="第一節 出会い"
        />
        <Input
          label="順序"
          type="number"
          value={String(order)}
          onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
        />
        <Textarea
          label="節の概要 / あらすじ"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="この節で描くシーンやキャラクターの行動など"
          rows={4}
        />
      </div>
    </Modal>
  );
}
