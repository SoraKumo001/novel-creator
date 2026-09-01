import type { Chapter, Section } from "@/lib/types.js";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from "./-Icons.js";

export function ChapterTreeItem({
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
  onMoveChapterUp,
  onMoveChapterDown,
  onMoveSectionUp,
  onMoveSectionDown,
  canMoveUp,
  canMoveDown,
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
  onMoveChapterUp: () => void;
  onMoveChapterDown: () => void;
  onMoveSectionUp: (sectionId: string) => void;
  onMoveSectionDown: (sectionId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  generatingSummaryId: string | null;
}) {
  const isGeneratingChapter = generatingSummaryId === chapter.id;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between bg-surface px-4 py-3 transition hover:bg-surface-hover/50">
        <div
          className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-3"
          onClick={onToggle}
        >
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
          <div className="truncate">
            <span className="mr-2 font-semibold text-foreground">
              第 {chapter.order} 章: {chapter.title}
            </span>
            <span className="text-muted-foreground text-xs">
              ({chapter.sections.length} 節)
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label="章を上に移動"
            icon={<ArrowUpIcon />}
            onClick={onMoveChapterUp}
            disabled={!canMoveUp}
          />
          <IconButton
            label="章を下に移動"
            icon={<ArrowDownIcon />}
            onClick={onMoveChapterDown}
            disabled={!canMoveDown}
          />
          <IconButton
            label={
              isGeneratingChapter ? "概要を生成中..." : "AIで章の概要を生成"
            }
            icon={
              isGeneratingChapter ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <SparklesIcon />
              )
            }
            onClick={() => void onGenerateChapterSummary()}
            disabled={!!generatingSummaryId}
          />
          <IconButton
            label="節を追加"
            icon={<PlusIcon />}
            onClick={onAddSection}
          />
          <IconButton
            label="章を編集"
            icon={<PencilIcon />}
            onClick={onEditChapter}
          />
          <IconButton
            label="章を削除"
            icon={<TrashIcon />}
            onClick={onDeleteChapter}
          />
        </div>
      </div>

      {chapter.summary && (
        <div className="border-border border-t bg-surface-raised/40 px-5 py-2.5 text-muted-foreground text-xs leading-relaxed">
          {chapter.summary}
        </div>
      )}

      {isExpanded && (
        <div className="space-y-2 border-border border-t bg-surface-raised/20 p-3">
          {chapter.sections.length === 0 ? (
            <p className="p-2 text-muted-foreground text-xs italic">
              節がまだありません。
            </p>
          ) : (
            chapter.sections.map((section, secIdx) => {
              const isGeneratingSec = generatingSummaryId === section.id;
              return (
                <div
                  key={section.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground text-sm">
                      節 {section.order}: {section.title || "（無題）"}
                    </div>
                    {section.summary ? (
                      <div className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
                        {section.summary}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-muted-foreground/60 text-xs italic">
                        概要なし（✨
                        概要生成ボタンでAIにあらすじを考えてもらえます）
                      </div>
                    )}
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    <IconButton
                      label="節を上に移動"
                      icon={<ArrowUpIcon />}
                      onClick={() => onMoveSectionUp(section.id)}
                      disabled={secIdx === 0}
                    />
                    <IconButton
                      label="節を下に移動"
                      icon={<ArrowDownIcon />}
                      onClick={() => onMoveSectionDown(section.id)}
                      disabled={secIdx === chapter.sections.length - 1}
                    />
                    <IconButton
                      label={
                        isGeneratingSec
                          ? "概要を生成中..."
                          : "AIで節の概要を生成"
                      }
                      icon={
                        isGeneratingSec ? (
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
