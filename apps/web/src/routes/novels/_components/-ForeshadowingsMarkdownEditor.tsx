import { PresetEntityMarkdownEditor } from "./-PresetEntityMarkdownEditor.js";

interface ForeshadowingsMarkdownEditorProps {
  fetchForeshadowingsMarkdown: () => Promise<string>;
  novelId: string;
  saveForeshadowingsMarkdown: (
    markdown: string
  ) => Promise<{ created: number; updated: number; deleted: number }>;
  savingMarkdown: boolean;
}

export function ForeshadowingsMarkdownEditor({
  novelId,
  fetchForeshadowingsMarkdown,
  saveForeshadowingsMarkdown,
  savingMarkdown,
}: ForeshadowingsMarkdownEditorProps) {
  return (
    <PresetEntityMarkdownEditor
      preset="foreshadowings"
      novelId={novelId}
      fetchMarkdown={fetchForeshadowingsMarkdown}
      saveMarkdown={saveForeshadowingsMarkdown}
      savingMarkdown={savingMarkdown}
    />
  );
}
