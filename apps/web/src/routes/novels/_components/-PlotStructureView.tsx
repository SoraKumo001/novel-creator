import { AIProgressIndicator } from "@/components/AIProgressIndicator.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { EmptyState } from "@/components/EmptyState.js";
import { Loading } from "@/components/Loading.js";
import type {
  Chapter,
  ChapterWithSections,
  GeneratedPlot,
  Section,
} from "@/lib/types.js";
import { ChapterSectionFormModal } from "./-ChapterSectionFormModal.js";
import { ChapterTreeItem } from "./-ChapterTreeItem.js";
import { PlotPreviewPanel } from "./-PlotPreviewPanel.js";

export interface PlotStructureViewProps {
  activeGeneratingId: string | null;
  chapterForm: Chapter | null;
  chapters: ChapterWithSections[];
  creating: boolean;
  deleteTarget: { type: "chapter" | "section"; id: string } | null;
  deleting: boolean;
  expandedChapterIds: Set<string>;
  generateStartedAt: number | null;
  generatingPlot: boolean;
  loading: boolean;
  onAddSection: (chapterId: string) => void;
  onApplyPlot: () => void;
  onCancelGeneration: () => void;
  onCloseChapterForm: () => void;
  onCloseDelete: () => void;
  onCloseSectionForm: () => void;
  onConfirmDelete: () => void;
  onDeleteChapter: (chapterId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onDiscardPlot: () => void;
  onEditChapter: (chapter: Chapter) => void;
  onEditSection: (chapterId: string, section: Section) => void;
  onGenerateChapterSummary: (chapterId: string) => Promise<void>;
  onGenerateSectionSummary: (sectionId: string) => Promise<void>;
  onMoveChapter: (chapterId: string, direction: "up" | "down") => void;
  onMoveSection: (
    chapterId: string,
    sectionId: string,
    direction: "up" | "down"
  ) => void;
  onSaveChapter: (input: {
    title: string;
    order: number;
    summary: string;
  }) => Promise<void>;
  onSaveSection: (input: {
    title: string;
    order: number;
    summary: string;
  }) => Promise<void>;
  onToggleAllPlot: (checked: boolean) => void;
  onToggleChapter: (chapterId: string) => void;
  onTogglePlotIndex: (index: number) => void;
  plotPreview: GeneratedPlot | null;
  sectionForm: { chapterId: string; section?: Section } | null;
  selectedPlotIndices: Set<number>;
  updating: boolean;
}

/** PlotTab のツリー表示・プレビュー・ダイアログ部分 */
export function PlotStructureView(props: PlotStructureViewProps) {
  const { chapters } = props;
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
      {props.generatingPlot && (
        <div className="fade-in animate-in rounded-xl border border-primary/40 bg-surface-raised p-5 shadow-md duration-200">
          <AIProgressIndicator
            stage="AIが小説設定・登場人物を参照してプロット構成を立案中..."
            description="物語の起承転結や伏線・キャラクター設定を考慮し、全章の構成案を生成しています"
            startedAt={props.generateStartedAt ?? Date.now()}
            onCancel={props.onCancelGeneration}
            cancelLabel="生成を中止"
            variant="panel"
          />
        </div>
      )}

      {props.plotPreview && (
        <PlotPreviewPanel
          plotPreview={props.plotPreview}
          selectedPlotIndices={props.selectedPlotIndices}
          onToggleAll={props.onToggleAllPlot}
          onToggleIndex={props.onTogglePlotIndex}
          onApply={props.onApplyPlot}
          onDiscard={props.onDiscardPlot}
        />
      )}

      {props.loading && <Loading message="章一覧を読み込み中..." />}

      {!props.loading &&
        chapters.length === 0 &&
        !props.generatingPlot &&
        !props.plotPreview && (
          <EmptyState
            title="章が登録されていません"
            description="「章を追加」または「プロット自動生成」から構成を作成しましょう。"
          />
        )}

      {!props.loading && chapters.length > 0 && (
        <div className="space-y-3">
          {chapters.map((chapter, chIdx) => (
            <ChapterTreeItem
              key={chapter.id}
              chapter={chapter}
              isExpanded={props.expandedChapterIds.has(chapter.id)}
              onToggle={() => props.onToggleChapter(chapter.id)}
              onEditChapter={() => props.onEditChapter(chapter)}
              onDeleteChapter={() => props.onDeleteChapter(chapter.id)}
              onAddSection={() => props.onAddSection(chapter.id)}
              onEditSection={(section) =>
                props.onEditSection(chapter.id, section)
              }
              onDeleteSection={(section) => props.onDeleteSection(section.id)}
              onGenerateChapterSummary={() =>
                props.onGenerateChapterSummary(chapter.id)
              }
              onGenerateSectionSummary={(s) =>
                props.onGenerateSectionSummary(s.id)
              }
              onMoveChapterUp={() => props.onMoveChapter(chapter.id, "up")}
              onMoveChapterDown={() => props.onMoveChapter(chapter.id, "down")}
              onMoveSectionUp={(sId) =>
                props.onMoveSection(chapter.id, sId, "up")
              }
              onMoveSectionDown={(sId) =>
                props.onMoveSection(chapter.id, sId, "down")
              }
              canMoveUp={chIdx > 0}
              canMoveDown={chIdx < chapters.length - 1}
              generatingSummaryId={props.activeGeneratingId}
            />
          ))}
        </div>
      )}

      <ChapterSectionFormModal
        mode="chapter"
        isOpen={!!props.chapterForm}
        onClose={props.onCloseChapterForm}
        onSubmit={props.onSaveChapter}
        isLoading={props.chapterForm ? props.updating : props.creating}
        title={props.chapterForm ? "章を編集" : "章を追加"}
        defaultValues={props.chapterForm ?? undefined}
      />
      <ChapterSectionFormModal
        mode="section"
        isOpen={!!props.sectionForm}
        onClose={props.onCloseSectionForm}
        onSubmit={props.onSaveSection}
        isLoading={props.sectionForm?.section ? props.updating : props.creating}
        title={props.sectionForm?.section ? "節を編集" : "節を追加"}
        defaultValues={props.sectionForm?.section}
      />
      <ConfirmDialog
        isOpen={!!props.deleteTarget}
        onClose={props.onCloseDelete}
        onConfirm={props.onConfirmDelete}
        title={
          props.deleteTarget?.type === "chapter"
            ? "章を削除しますか？"
            : "節を削除しますか？"
        }
        message="紐づく本文や時系列も削除されます。"
        confirmLabel="削除"
        isLoading={props.deleting}
      />
    </div>
  );
}
