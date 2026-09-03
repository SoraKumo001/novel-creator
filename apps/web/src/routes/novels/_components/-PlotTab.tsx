import { useEffect, useState } from "react";
import { AIProgressIndicator } from "@/components/AIProgressIndicator.js";
import { Button } from "@/components/Button.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { EmptyState } from "@/components/EmptyState.js";
import { LLMModelSelector } from "@/components/LLMModelSelector.js";
import { Loading } from "@/components/Loading.js";
import { ViewModeSwitch } from "@/components/ViewModeSwitch.js";
import { useChapters } from "@/hooks/useChapters.js";

import { useGenerate } from "@/hooks/useGenerate.js";
import { useNovel } from "@/hooks/useNovel.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import type { Chapter, Section } from "@/lib/types.js";
import { ChapterSectionFormModal } from "./-ChapterSectionFormModal.js";
import { ChapterTreeItem } from "./-ChapterTreeItem.js";
import { PlusIcon, SparklesIcon } from "./-Icons.js";
import { PlotMarkdownEditor } from "./-PlotMarkdownEditor.js";
import { PlotPreviewPanel } from "./-PlotPreviewPanel.js";

export function PlotTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  onRefresh: () => Promise<void>;
}) {
  const toast = useToast();

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
    fetchPlotMarkdown,
    savePlotMarkdown,
    savingMarkdown,
    creating,
    updating,
    deleting,
  } = useChapters(novel.id);
  const {
    generatePlot,
    generateChapterSummary,
    generateSectionSummary,
    generatingPlot,
    startedAt: generateStartedAt,
    cancelGeneration,
    generatedPlot,
    resetGeneratedPlot,
  } = useGenerate();

  const [viewMode, setViewMode] = useState<"structure" | "markdown">(
    "structure"
  );
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(
    new Set()
  );

  const [chapterForm, setChapterForm] = useState<Chapter | null>(null);
  const [sectionForm, setSectionForm] = useState<{
    chapterId: string;
    section?: Section;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "chapter" | "section";
    id: string;
  } | null>(null);

  const [plotPreview, setPlotPreview] = useState(generatedPlot);
  const [selectedPlotIndices, setSelectedPlotIndices] = useState<Set<number>>(
    new Set()
  );
  const [activeGeneratingId, setActiveGeneratingId] = useState<string | null>(
    null
  );
  const [selectedModelConfigId, setSelectedModelConfigId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (generatedPlot) {
      setPlotPreview(generatedPlot);
      setSelectedPlotIndices(new Set(generatedPlot.chapters.map((_, i) => i)));
    }
  }, [generatedPlot]);

  async function handleGeneratePlot() {
    resetGeneratedPlot();
    try {
      const plot = await generatePlot(novel.id, selectedModelConfigId);
      setPlotPreview(plot);
      setSelectedPlotIndices(new Set(plot.chapters.map((_, i) => i)));
      toast.success("プロット構成案を生成しました");
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  async function handleApplyPlot() {
    if (!plotPreview) {
      return;
    }
    try {
      const selectedChapters = plotPreview.chapters.filter((_, i) =>
        selectedPlotIndices.has(i)
      );
      for (const ch of selectedChapters) {
        await createChapter({
          title: ch.title,
          order: ch.order,
          summary: ch.summary,
        });
      }
      setPlotPreview(null);
      setSelectedPlotIndices(new Set());
      toast.success(`${selectedChapters.length} 件の章を追加しました`);
      await onRefresh();
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
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

  async function handleSaveChapter(input: {
    title: string;
    order: number;
    summary: string;
  }) {
    try {
      if (chapterForm) {
        await updateChapter(chapterForm.id, input);
        toast.success("章を更新しました");
      } else {
        await createChapter(input);
        toast.success("章を追加しました");
      }
      setChapterForm(null);
      await onRefresh();
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  async function handleSaveSection(input: {
    title: string;
    order: number;
    summary: string;
  }) {
    if (!sectionForm) {
      return;
    }
    try {
      if (sectionForm.section) {
        await updateSection(sectionForm.section.id, input);
        toast.success("節を更新しました");
      } else {
        await createSection(sectionForm.chapterId, input);
        toast.success("節を追加しました");
      }
      setSectionForm(null);
      await onRefresh();
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    try {
      if (deleteTarget.type === "chapter") {
        await deleteChapter(deleteTarget.id);
        toast.success("章を削除しました");
      } else {
        await deleteSection(deleteTarget.id);
        toast.success("節を削除しました");
      }
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  async function handleGenerateChapterSummaryAction(chapterId: string) {
    setActiveGeneratingId(chapterId);
    try {
      await generateChapterSummary(chapterId);
      await refetchChapters();
      await onRefresh();
      toast.success("章のあらすじを生成しました");
    } catch (err) {
      toast.error(toErrorMessage(err));
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
      toast.success("節のあらすじを生成しました");
    } catch (err) {
      toast.error(toErrorMessage(err));
    } finally {
      setActiveGeneratingId(null);
    }
  }

  async function handleMoveChapter(
    chapterId: string,
    direction: "up" | "down"
  ) {
    const sorted = [...chapters].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === chapterId);
    if (index === -1) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) {
      return;
    }

    const current = sorted[index];
    const target = sorted[targetIndex];

    const currentOrder = current.order;
    const targetOrder = target.order;

    await updateChapter(current.id, {
      title: current.title,
      order: targetOrder,
      summary: current.summary ?? "",
    });
    await updateChapter(target.id, {
      title: target.title,
      order: currentOrder,
      summary: target.summary ?? "",
    });

    await onRefresh();
  }

  async function handleMoveSection(
    chapterId: string,
    sectionId: string,
    direction: "up" | "down"
  ) {
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) {
      return;
    }
    const sorted = [...chapter.sections].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((s) => s.id === sectionId);
    if (index === -1) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) {
      return;
    }

    const current = sorted[index];
    const target = sorted[targetIndex];

    const currentOrder = current.order;
    const targetOrder = target.order;

    await updateSection(current.id, {
      title: current.title ?? "",
      order: targetOrder,
      summary: current.summary ?? "",
    });
    await updateSection(target.id, {
      title: target.title ?? "",
      order: currentOrder,
      summary: target.summary ?? "",
    });

    await onRefresh();
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* ツールバー */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-border border-b pb-3">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-foreground text-xl">
            章立て・プロット
          </h2>
          {viewMode === "structure" && chapters.length > 0 && (
            <button
              onClick={toggleExpandAll}
              className="cursor-pointer text-muted-foreground text-xs transition hover:text-foreground"
            >
              {expandedChapterIds.size === chapters.length
                ? "すべて折りたたむ"
                : "すべて展開"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === "structure" && (
            <>
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
                className="shrink-0 whitespace-nowrap"
              >
                プロット自動生成
              </Button>
              <Button
                onClick={() => setChapterForm({} as Chapter)}
                leftIcon={<PlusIcon />}
                className="shrink-0 whitespace-nowrap"
              >
                章を追加
              </Button>
            </>
          )}
          <ViewModeSwitch
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: "ツリー", value: "structure" },
              { label: "マークダウン", value: "markdown" },
            ]}
          />
        </div>
      </div>

      {viewMode === "markdown" ? (
        <div className="min-h-0 flex-1">
          <PlotMarkdownEditor
            novelId={novel.id}
            fetchPlotMarkdown={fetchPlotMarkdown}
            savePlotMarkdown={savePlotMarkdown}
            savingMarkdown={savingMarkdown}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          {generatingPlot && (
            <div className="fade-in animate-in rounded-xl border border-primary/40 bg-surface-raised p-5 shadow-md duration-200">
              <AIProgressIndicator
                stage="AIが小説設定・登場人物を参照してプロット構成を立案中..."
                description="物語の起承転結や伏線・キャラクター設定を考慮し、全章の構成案を生成しています"
                startedAt={generateStartedAt ?? Date.now()}
                onCancel={cancelGeneration}
                cancelLabel="生成を中止"
                variant="panel"
              />
            </div>
          )}

          {plotPreview && (
            <PlotPreviewPanel
              plotPreview={plotPreview}
              selectedPlotIndices={selectedPlotIndices}
              onToggleAll={(checked) => {
                if (checked) {
                  setSelectedPlotIndices(
                    new Set(plotPreview.chapters.map((_, i) => i))
                  );
                } else {
                  setSelectedPlotIndices(new Set());
                }
              }}
              onToggleIndex={(index) => {
                setSelectedPlotIndices((prev) => {
                  const next = new Set(prev);
                  if (next.has(index)) {
                    next.delete(index);
                  } else {
                    next.add(index);
                  }
                  return next;
                });
              }}
              onApply={() => void handleApplyPlot()}
              onDiscard={() => {
                setPlotPreview(null);
                setSelectedPlotIndices(new Set());
              }}
            />
          )}

          {loading && <Loading message="章一覧を読み込み中..." />}

          {!loading &&
            chapters.length === 0 &&
            !generatingPlot &&
            !plotPreview && (
              <EmptyState
                title="章が登録されていません"
                description="「章を追加」または「プロット自動生成」から構成を作成しましょう。"
              />
            )}

          {!loading && chapters.length > 0 && (
            <div className="space-y-3">
              {chapters.map((chapter, chIdx) => (
                <ChapterTreeItem
                  key={chapter.id}
                  chapter={chapter}
                  isExpanded={expandedChapterIds.has(chapter.id)}
                  onToggle={() => toggleChapterExpand(chapter.id)}
                  onEditChapter={() => setChapterForm(chapter)}
                  onDeleteChapter={() =>
                    setDeleteTarget({ type: "chapter", id: chapter.id })
                  }
                  onAddSection={() => setSectionForm({ chapterId: chapter.id })}
                  onEditSection={(section) =>
                    setSectionForm({ chapterId: chapter.id, section })
                  }
                  onDeleteSection={(section) =>
                    setDeleteTarget({ type: "section", id: section.id })
                  }
                  onGenerateChapterSummary={() =>
                    handleGenerateChapterSummaryAction(chapter.id)
                  }
                  onGenerateSectionSummary={(s) =>
                    handleGenerateSectionSummaryAction(s.id)
                  }
                  onMoveChapterUp={() =>
                    void handleMoveChapter(chapter.id, "up")
                  }
                  onMoveChapterDown={() =>
                    void handleMoveChapter(chapter.id, "down")
                  }
                  onMoveSectionUp={(sId) =>
                    void handleMoveSection(chapter.id, sId, "up")
                  }
                  onMoveSectionDown={(sId) =>
                    void handleMoveSection(chapter.id, sId, "down")
                  }
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
            title={chapterForm ? "章を編集" : "章を追加"}
            defaultValues={chapterForm ?? undefined}
          />
          <ChapterSectionFormModal
            mode="section"
            isOpen={!!sectionForm}
            onClose={() => setSectionForm(null)}
            onSubmit={handleSaveSection}
            isLoading={sectionForm?.section ? updating : creating}
            title={sectionForm?.section ? "節を編集" : "節を追加"}
            defaultValues={sectionForm?.section}
          />
          <ConfirmDialog
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            title={
              deleteTarget?.type === "chapter"
                ? "章を削除しますか？"
                : "節を削除しますか？"
            }
            message="紐づく本文や時系列も削除されます。"
            confirmLabel="削除"
            isLoading={deleting}
          />
        </div>
      )}
    </div>
  );
}
