import { useEffect, useState } from "react";
import { Button } from "@/components/Button.js";
import { PlusIcon, SparklesIcon } from "@/components/Icons.js";
import { LLMModelSelector } from "@/components/LLMModelSelector.js";
import { TabHeader } from "@/components/TabHeader.js";
import { ViewModeSwitch } from "@/components/ViewModeSwitch.js";
import { useChapters } from "@/hooks/useChapters.js";
import { useGenerate } from "@/hooks/useGenerate.js";
import { type NovelMutations, useNovel } from "@/hooks/useNovel.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import type { Chapter, Section } from "@/lib/types.js";
import { swapChapterOrder, swapSectionOrder } from "./-PlotMoveUtils.js";
import { PlotStructureView } from "./-PlotStructureView.js";
import { PresetEntityMarkdownEditor } from "./-PresetEntityMarkdownEditor.js";

export function PlotTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  novelMutations?: NovelMutations;
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
    await swapChapterOrder(
      chapters,
      chapterId,
      direction,
      updateChapter,
      onRefresh
    );
  }

  async function handleMoveSection(
    chapterId: string,
    sectionId: string,
    direction: "up" | "down"
  ) {
    await swapSectionOrder(
      chapters,
      chapterId,
      sectionId,
      direction,
      updateSection,
      onRefresh
    );
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <TabHeader
        title="章立て・プロット"
        leftExtra={
          viewMode === "structure" &&
          chapters.length > 0 && (
            <button
              onClick={toggleExpandAll}
              className="cursor-pointer text-muted-foreground text-xs transition hover:text-foreground"
            >
              {expandedChapterIds.size === chapters.length
                ? "すべて折りたたむ"
                : "すべて展開"}
            </button>
          )
        }
        rightControls={
          viewMode === "structure" && (
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
          )
        }
        viewModeSwitch={
          <ViewModeSwitch
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: "ツリー", value: "structure" },
              { label: "マークダウン", value: "markdown" },
            ]}
          />
        }
      />

      {viewMode === "markdown" ? (
        <div className="min-h-0 flex-1">
          <PresetEntityMarkdownEditor
            preset="plot"
            novelId={novel.id}
            fetchMarkdown={fetchPlotMarkdown}
            saveMarkdown={savePlotMarkdown}
            savingMarkdown={savingMarkdown}
          />
        </div>
      ) : (
        <PlotStructureView
          chapters={chapters}
          loading={loading}
          generatingPlot={generatingPlot}
          generateStartedAt={generateStartedAt}
          plotPreview={plotPreview}
          selectedPlotIndices={selectedPlotIndices}
          expandedChapterIds={expandedChapterIds}
          chapterForm={chapterForm}
          sectionForm={sectionForm}
          deleteTarget={deleteTarget}
          creating={creating}
          updating={updating}
          deleting={deleting}
          activeGeneratingId={activeGeneratingId}
          onToggleChapter={toggleChapterExpand}
          onEditChapter={setChapterForm}
          onDeleteChapter={(id) => setDeleteTarget({ type: "chapter", id })}
          onAddSection={(chapterId) => setSectionForm({ chapterId })}
          onEditSection={(chapterId, section) =>
            setSectionForm({ chapterId, section })
          }
          onDeleteSection={(id) => setDeleteTarget({ type: "section", id })}
          onGenerateChapterSummary={handleGenerateChapterSummaryAction}
          onGenerateSectionSummary={handleGenerateSectionSummaryAction}
          onMoveChapter={(id, dir) => void handleMoveChapter(id, dir)}
          onMoveSection={(cId, sId, dir) =>
            void handleMoveSection(cId, sId, dir)
          }
          onToggleAllPlot={(checked) => {
            if (checked && plotPreview) {
              setSelectedPlotIndices(
                new Set(plotPreview.chapters.map((_, i) => i))
              );
            } else {
              setSelectedPlotIndices(new Set());
            }
          }}
          onTogglePlotIndex={(index) => {
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
          onApplyPlot={() => void handleApplyPlot()}
          onDiscardPlot={() => {
            setPlotPreview(null);
            setSelectedPlotIndices(new Set());
          }}
          onCancelGeneration={cancelGeneration}
          onSaveChapter={handleSaveChapter}
          onSaveSection={handleSaveSection}
          onCloseChapterForm={() => setChapterForm(null)}
          onCloseSectionForm={() => setSectionForm(null)}
          onCloseDelete={() => setDeleteTarget(null)}
          onConfirmDelete={() => void handleDelete()}
        />
      )}
    </div>
  );
}
