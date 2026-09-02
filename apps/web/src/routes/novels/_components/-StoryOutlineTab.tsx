import type { useNovel } from "@/hooks/useNovel.js";
import { StoryOutlineMarkdownEditor } from "./-StoryOutlineMarkdownEditor.js";

export function StoryOutlineTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>["novel"]>;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="h-full min-h-0 flex-1 overflow-hidden">
      <StoryOutlineMarkdownEditor novelId={novel.id} onRefresh={onRefresh} />
    </div>
  );
}
