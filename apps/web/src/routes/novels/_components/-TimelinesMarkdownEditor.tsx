import {
  buildTimelineCategoryTree,
  findTimelineSectionByLine,
  type TimelineSectionRange,
} from "@novel-creator/shared";
import { EntityMarkdownEditor } from "./-EntityMarkdownEditor.js";

interface TimelinesMarkdownEditorProps {
  fetchTimelinesMarkdown: () => Promise<string>;
  novelId: string;
  saveTimelinesMarkdown: (
    markdown: string
  ) => Promise<{ created: number; deleted: number; updated: number }>;
  savingMarkdown: boolean;
}

export function TimelinesMarkdownEditor({
  novelId,
  fetchTimelinesMarkdown,
  saveTimelinesMarkdown,
  savingMarkdown,
}: TimelinesMarkdownEditorProps) {
  return (
    <EntityMarkdownEditor<TimelineSectionRange>
      novelId={novelId}
      entityTitle="年表"
      entityType="timelines_markdown"
      storageKey={`novel-creator:draft:timelines:${novelId}`}
      fetchMarkdown={fetchTimelinesMarkdown}
      saveMarkdown={saveTimelinesMarkdown}
      buildTree={buildTimelineCategoryTree}
      findSectionAtLine={findTimelineSectionByLine}
      savingMarkdown={savingMarkdown}
    />
  );
}
