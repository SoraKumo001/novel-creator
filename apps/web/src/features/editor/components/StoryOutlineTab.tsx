import { StoryOutlineMarkdownEditor } from "@/features/editor/components/StoryOutlineMarkdownEditor.js";
import type { NovelMutations, useNovel } from "@/hooks/useNovel.js";

export function StoryOutlineTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  novelMutations?: NovelMutations;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="h-full min-h-0 flex-1 overflow-hidden">
      <StoryOutlineMarkdownEditor novelId={novel.id} onRefresh={onRefresh} />
    </div>
  );
}
