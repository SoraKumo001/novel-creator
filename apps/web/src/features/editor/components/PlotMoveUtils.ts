import type { ChapterWithSections } from "@/lib/types.js";

/** PlotTab の章・節並び替えロジック（routes 配下の局所ヘルパー） */
export async function swapChapterOrder(
  chapters: ChapterWithSections[],
  chapterId: string,
  direction: "up" | "down",
  updateChapter: (
    id: string,
    input: { title: string; order: number; summary: string }
  ) => Promise<unknown>,
  onRefresh: () => Promise<void>
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
  await updateChapter(current.id, {
    title: current.title,
    order: target.order,
    summary: current.summary ?? "",
  });
  await updateChapter(target.id, {
    title: target.title,
    order: current.order,
    summary: target.summary ?? "",
  });
  await onRefresh();
}

export async function swapSectionOrder(
  chapters: ChapterWithSections[],
  chapterId: string,
  sectionId: string,
  direction: "up" | "down",
  updateSection: (
    id: string,
    input: { title: string; order: number; summary: string }
  ) => Promise<unknown>,
  onRefresh: () => Promise<void>
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
  await updateSection(current.id, {
    title: current.title ?? "",
    order: target.order,
    summary: current.summary ?? "",
  });
  await updateSection(target.id, {
    title: target.title ?? "",
    order: current.order,
    summary: target.summary ?? "",
  });
  await onRefresh();
}
