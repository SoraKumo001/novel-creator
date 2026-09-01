import type { ChapterWithSections } from "@/lib/types.js";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  PlusIcon,
} from "./-Icons.js";

interface SectionSidebarProps {
  chapters: ChapterWithSections[];
  creating: boolean;
  draggingSectionId: string | null;
  dragOverPosition: "before" | "after" | null;
  dragOverSectionId: string | null;
  expandedChapterIds: Set<string>;
  onAddSection: (chapterId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, targetSectionId: string) => void;
  onDragStart: (e: React.DragEvent, sectionId: string) => void;
  onDrop: (
    e: React.DragEvent,
    targetChapterId: string,
    targetSectionId: string
  ) => void;
  onSelectSection: (chapterId: string, sectionId: string) => void;
  onToggleChapter: (chapterId: string) => void;
  selectedChapterId: string | null;
  selectedSectionId: string | null;
}

export function SectionSidebar({
  chapters,
  selectedChapterId,
  selectedSectionId,
  expandedChapterIds,
  draggingSectionId,
  dragOverSectionId,
  dragOverPosition,
  creating,
  onToggleChapter,
  onSelectSection,
  onAddSection,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: SectionSidebarProps) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto rounded-xl border border-border bg-surface p-3">
      <div className="mb-3 flex items-center justify-between px-2">
        <h3 className="font-bold text-muted-foreground text-xs uppercase tracking-wide">
          章 / 節 一覧
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {chapters.length} 章
        </span>
      </div>

      {chapters.length === 0 ? (
        <p className="px-2 text-muted-foreground text-sm">
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
                    ? "border-primary/40 bg-surface-raised/60"
                    : "border-border/60 bg-surface"
                }`}
              >
                {/* 章ヘッダー */}
                <div className="flex items-center justify-between p-2">
                  <button
                    type="button"
                    onClick={() => onToggleChapter(chapter.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-semibold text-foreground text-xs transition hover:text-primary"
                  >
                    <span className="shrink-0 text-muted-foreground">
                      {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </span>
                    <span className="truncate">{chapter.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddSection(chapter.id)}
                    disabled={creating}
                    className="ml-1 shrink-0 rounded p-1 text-muted-foreground transition hover:bg-surface-hover hover:text-primary"
                    title="この章に節を追加"
                  >
                    <PlusIcon />
                  </button>
                </div>

                {/* 節一覧（ドラッグ＆ドロップ対応） */}
                {isExpanded && hasSections && (
                  <div className="space-y-1 border-border/40 border-t px-2 py-1.5">
                    {chapter.sections.map((section) => {
                      const isSelected = selectedSectionId === section.id;
                      const isDragging = draggingSectionId === section.id;
                      const isDragOver = dragOverSectionId === section.id;

                      return (
                        <div
                          key={section.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, section.id)}
                          onDragOver={(e) => onDragOver(e, section.id)}
                          onDragEnd={onDragEnd}
                          onDrop={(e) => onDrop(e, chapter.id, section.id)}
                          className={`group relative flex cursor-pointer select-none items-center gap-1 rounded px-1.5 py-1 text-xs transition ${
                            isDragging ? "opacity-30" : ""
                          } ${
                            isSelected
                              ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                              : "text-foreground hover:bg-surface-hover"
                          } ${
                            isDragOver && dragOverPosition === "before"
                              ? "border-primary border-t-2"
                              : ""
                          } ${
                            isDragOver && dragOverPosition === "after"
                              ? "border-primary border-b-2"
                              : ""
                          }`}
                          onClick={() =>
                            onSelectSection(chapter.id, section.id)
                          }
                        >
                          {/* ドラッグハンドル */}
                          <span
                            className={`shrink-0 cursor-grab opacity-40 transition group-hover:opacity-100 ${
                              isSelected
                                ? "text-primary-foreground"
                                : "text-muted-foreground"
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
  );
}
