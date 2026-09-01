import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button.js";
import { useChapters } from "@/hooks/useChapters.js";
import { useNovel } from "@/hooks/useNovel.js";
import type { Section } from "@/lib/types.js";

import { PlusIcon } from "./-Icons.js";
import { SectionEditor } from "./-SectionEditor.js";
import { SectionSidebar } from "./-SectionSidebar.js";

export function EditorTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  onRefresh: () => Promise<void>;
}) {
  const { chapters, createSection, updateSection, creating } = useChapters(
    novel.id
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    null
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null
  );
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(
    new Set()
  );
  const [editorKey, setEditorKey] = useState(0);
  const [isZenMode, setIsZenMode] = useState(false);

  // ドラッグ＆ドロップ用ステート
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(
    null
  );
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(
    null
  );
  const [dragOverPosition, setDragOverPosition] = useState<
    "before" | "after" | null
  >(null);

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
      if (e.key === "Escape" && isZenMode) {
        setIsZenMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZenMode]);

  const toggleChapterExpand = useCallback((chapterId: string) => {
    setExpandedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }, []);

  const handleSelectSection = useCallback(
    (chapterId: string, sectionId: string) => {
      setSelectedChapterId(chapterId);
      setSelectedSectionId(sectionId);
      setEditorKey((k) => k + 1);
    },
    []
  );

  const handleAddSection = async (chapterId: string) => {
    const targetChapter = chapters.find((c) => c.id === chapterId);
    const nextOrder = (targetChapter?.sections.length ?? 0) + 1;
    const newSec = await createSection(chapterId, {
      title: `節 ${nextOrder}`,
      order: nextOrder,
      summary: "",
    });
    setSelectedChapterId(chapterId);
    setSelectedSectionId(newSec.id);
    setExpandedChapterIds((prev) => new Set([...prev, chapterId]));
    setEditorKey((k) => k + 1);
    await onRefresh();
  };

  const handleUpdateSectionTitle = async (
    section: Section,
    newTitle: string
  ) => {
    await updateSection(section.id, {
      title: newTitle.trim(),
      order: section.order,
      summary: section.summary ?? "",
    });
    await onRefresh();
  };

  // ドラッグ＆ドロップハンドラ
  const handleDragStart = useCallback(
    (e: React.DragEvent, sectionId: string) => {
      e.dataTransfer.setData("text/plain", sectionId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingSectionId(sectionId);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetSectionId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggingSectionId === targetSectionId) {
        setDragOverSectionId(null);
        setDragOverPosition(null);
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const pos = e.clientY < mid ? "before" : "after";
      setDragOverSectionId(targetSectionId);
      setDragOverPosition(pos);
    },
    [draggingSectionId]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingSectionId(null);
    setDragOverSectionId(null);
    setDragOverPosition(null);
  }, []);

  const handleDrop = useCallback(
    async (
      e: React.DragEvent,
      targetChapterId: string,
      targetSectionId: string
    ) => {
      e.preventDefault();
      const sourceSectionId =
        e.dataTransfer.getData("text/plain") || draggingSectionId;
      setDraggingSectionId(null);
      setDragOverSectionId(null);
      setDragOverPosition(null);

      if (!sourceSectionId || sourceSectionId === targetSectionId) {
        return;
      }

      const targetChapter = chapters.find((c) => c.id === targetChapterId);
      if (!targetChapter) {
        return;
      }

      // 移動対象の節を取得
      let sourceSection: Section | undefined;
      for (const c of chapters) {
        sourceSection = c.sections.find((s) => s.id === sourceSectionId);
        if (sourceSection) {
          break;
        }
      }
      if (!sourceSection) {
        return;
      }

      // 同一章内の並び替え
      const remaining = targetChapter.sections.filter(
        (s) => s.id !== sourceSectionId
      );
      const targetIdx = remaining.findIndex((s) => s.id === targetSectionId);
      if (targetIdx === -1) {
        return;
      }

      const insertIdx =
        dragOverPosition === "after" ? targetIdx + 1 : targetIdx;
      remaining.splice(insertIdx, 0, sourceSection);

      // 順序（order）を更新
      for (let i = 0; i < remaining.length; i++) {
        const s = remaining[i];
        const newOrder = i + 1;
        if (s.order !== newOrder) {
          await updateSection(s.id, {
            title: s.title ?? "",
            order: newOrder,
            summary: s.summary ?? "",
          });
        }
      }

      await onRefresh();
    },
    [chapters, draggingSectionId, dragOverPosition, onRefresh, updateSection]
  );

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const selectedSection = selectedChapter?.sections.find(
    (s) => s.id === selectedSectionId
  );

  return (
    <div
      className={
        isZenMode
          ? "fixed inset-0 z-50 flex flex-col bg-background p-6"
          : "flex h-full min-h-0 w-full gap-4 overflow-hidden"
      }
    >
      {!isZenMode && (
        <SectionSidebar
          chapters={chapters}
          selectedChapterId={selectedChapterId}
          selectedSectionId={selectedSectionId}
          expandedChapterIds={expandedChapterIds}
          draggingSectionId={draggingSectionId}
          dragOverSectionId={dragOverSectionId}
          dragOverPosition={dragOverPosition}
          creating={creating}
          onToggleChapter={toggleChapterExpand}
          onSelectSection={handleSelectSection}
          onAddSection={(chapterId) => void handleAddSection(chapterId)}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDrop={(e, chapterId, sectionId) =>
            void handleDrop(e, chapterId, sectionId)
          }
        />
      )}

      <main
        className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm ${
          isZenMode ? "mx-auto w-full max-w-4xl" : ""
        }`}
      >
        {selectedSection ? (
          <SectionEditor
            key={editorKey}
            novelId={novel.id}
            section={selectedSection}
            onRefresh={onRefresh}
            onUpdateTitle={(newTitle) =>
              handleUpdateSectionTitle(selectedSection, newTitle)
            }
            isZenMode={isZenMode}
            onToggleZenMode={() => setIsZenMode((prev) => !prev)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center space-y-4 p-8 text-center">
            <div className="text-4xl">✍️</div>
            <div>
              <h3 className="font-semibold text-base text-foreground">
                {selectedChapter
                  ? `「${selectedChapter.title}」が選択されています`
                  : "執筆する節を選択してください"}
              </h3>
              <p className="mt-1 max-w-md text-muted-foreground text-xs">
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
