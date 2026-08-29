import { useEffect, useState } from 'react';
import { Button } from '@/components/Button.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { EmptyState } from '@/components/EmptyState.js';
import { LLMModelSelector } from '@/components/LLMModelSelector.js';
import { Loading } from '@/components/Loading.js';
import { useChapters } from '@/hooks/useChapters.js';
import { useGenerate } from '@/hooks/useGenerate.js';
import { useNovel } from '@/hooks/useNovel.js';
import type { Chapter, Section } from '@/lib/types.js';
import { PlusIcon, SparklesIcon } from './-Icons.js';
import { ChapterSectionFormModal } from './-ChapterSectionFormModal.js';
import { ChapterTreeItem } from './-ChapterTreeItem.js';
import { PlotPreviewPanel } from './-PlotPreviewPanel.js';

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
  const [selectedModelConfigId, setSelectedModelConfigId] = useState<string | null>(null);

  useEffect(() => {
    if (generatedPlot) {
      setPlotPreview(generatedPlot);
      setSelectedPlotIndices(new Set(generatedPlot.chapters.map((_, i) => i)));
    }
  }, [generatedPlot]);

  async function handleGeneratePlot() {
    resetGeneratedPlot();
    const plot = await generatePlot(novel.id, selectedModelConfigId);
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

  async function handleMoveChapter(chapterId: string, direction: 'up' | 'down') {
    const sorted = [...chapters].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === chapterId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const current = sorted[index];
    const target = sorted[targetIndex];

    const currentOrder = current.order;
    const targetOrder = target.order;

    await updateChapter(current.id, {
      title: current.title,
      order: targetOrder,
      summary: current.summary ?? '',
    });
    await updateChapter(target.id, {
      title: target.title,
      order: currentOrder,
      summary: target.summary ?? '',
    });

    await onRefresh();
  }

  async function handleMoveSection(chapterId: string, sectionId: string, direction: 'up' | 'down') {
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return;
    const sorted = [...chapter.sections].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((s) => s.id === sectionId);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const current = sorted[index];
    const target = sorted[targetIndex];

    const currentOrder = current.order;
    const targetOrder = target.order;

    await updateSection(current.id, {
      title: current.title ?? '',
      order: targetOrder,
      summary: current.summary ?? '',
    });
    await updateSection(target.id, {
      title: target.title ?? '',
      order: currentOrder,
      summary: target.summary ?? '',
    });

    await onRefresh();
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
        <div className="flex items-center gap-2">
          <LLMModelSelector
            value={selectedModelConfigId}
            onChange={setSelectedModelConfigId}
            size="sm"
          />
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
        <PlotPreviewPanel
          plotPreview={plotPreview}
          selectedPlotIndices={selectedPlotIndices}
          onToggleAll={(checked) => {
            if (checked) {
              setSelectedPlotIndices(new Set(plotPreview.chapters.map((_, i) => i)));
            } else {
              setSelectedPlotIndices(new Set());
            }
          }}
          onToggleIndex={(idx) => {
            setSelectedPlotIndices((prev) => {
              const next = new Set(prev);
              if (next.has(idx)) next.delete(idx);
              else next.add(idx);
              return next;
            });
          }}
          onDiscard={() => {
            setPlotPreview(null);
            setSelectedPlotIndices(new Set());
          }}
          onApply={handleApplyPlot}
        />
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
          {chapters.map((chapter, chIdx) => (
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
              onMoveChapterUp={() => void handleMoveChapter(chapter.id, 'up')}
              onMoveChapterDown={() => void handleMoveChapter(chapter.id, 'down')}
              onMoveSectionUp={(sId) => void handleMoveSection(chapter.id, sId, 'up')}
              onMoveSectionDown={(sId) => void handleMoveSection(chapter.id, sId, 'down')}
              canMoveUp={chIdx > 0}
              canMoveDown={chIdx < chapters.length - 1}
              generatingSummaryId={activeGeneratingId}
            />
          ))}
        </div>
      )}

      <ChapterSectionFormModal
        mode="chapter"
        isOpen={!!chapterForm}
        onClose={() => setChapterForm(null)}
        onSubmit={handleSaveChapter}
        isLoading={chapterForm ? updating : creating}
        title={chapterForm ? '章を編集' : '章を追加'}
        defaultValues={chapterForm ?? undefined}
      />
      <ChapterSectionFormModal
        mode="section"
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
