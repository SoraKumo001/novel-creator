import { PresetEntityMarkdownEditor } from "./-PresetEntityMarkdownEditor.js";

interface TimelinesMarkdownEditorProps {
  fetchTimelinesMarkdown: () => Promise<string>;
  novelId: string;
  saveTimelinesMarkdown: (
    markdown: string
  ) => Promise<{ created?: number; updated?: number; deleted?: number }>;
  savingMarkdown: boolean;
}

export function TimelinesMarkdownEditor({
  novelId,
  fetchTimelinesMarkdown,
  saveTimelinesMarkdown,
  savingMarkdown,
}: TimelinesMarkdownEditorProps) {
  return (
    <PresetEntityMarkdownEditor
      preset="timelines"
      novelId={novelId}
      fetchMarkdown={fetchTimelinesMarkdown}
      saveMarkdown={saveTimelinesMarkdown}
      savingMarkdown={savingMarkdown}
    />
  );
}
