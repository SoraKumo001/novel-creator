import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon, PlusIcon } from './-Icons.js';
import type { ChapterWithSections } from '@/lib/types.js';

interface SectionSidebarProps {
  chapters: ChapterWithSections[];
  selectedChapterId: string | null;
  selectedSectionId: string | null;
  expandedChapterIds: Set<string>;
  draggingSectionId: string | null;
  dragOverSectionId: string | null;
  dragOverPosition: 'before' | 'after' | null;
  creating: boolean;
  onToggleChapter: (chapterId: string) => void;
  onSelectSection: (chapterId: string, sectionId: string) => void;
  onAddSection: (chapterId: string) => void;
  onDragStart: (e: React.DragEvent, sectionId: string) => void;
  onDragOver: (e: React.DragEvent, targetSectionId: string) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, targetChapterId: string, targetSectionId: string) => void;
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
                    onClick={() => onToggleChapter(chapter.id)}
                    className="flex flex-1 items-center gap-1.5 text-left text-xs font-semibold text-foreground hover:text-primary transition min-w-0"
                  >
                    <span className="text-muted-foreground shrink-0">
                      {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </span>
                    <span className="truncate">{chapter.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddSection(chapter.id)}
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
                          onDragStart={(e) => onDragStart(e, section.id)}
                          onDragOver={(e) => onDragOver(e, section.id)}
                          onDragEnd={onDragEnd}
                          onDrop={(e) => onDrop(e, chapter.id, section.id)}
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
                          onClick={() => onSelectSection(chapter.id, section.id)}
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
  );
}
