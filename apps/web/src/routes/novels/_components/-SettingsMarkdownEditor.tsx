import type { SaveSettingsMarkdownResult } from "@/lib/types.js";
import { PresetEntityMarkdownEditor } from "./-PresetEntityMarkdownEditor.js";

interface SettingsMarkdownEditorProps {
  fetchSettingsMarkdown: () => Promise<string>;
  novelId: string;
  saveSettingsMarkdown: (
    markdown: string
  ) => Promise<SaveSettingsMarkdownResult>;
  savingMarkdown: boolean;
}

export function SettingsMarkdownEditor({
  novelId,
  fetchSettingsMarkdown,
  saveSettingsMarkdown,
  savingMarkdown,
}: SettingsMarkdownEditorProps) {
  return (
    <PresetEntityMarkdownEditor
      preset="settings"
      novelId={novelId}
      fetchMarkdown={fetchSettingsMarkdown}
      saveMarkdown={saveSettingsMarkdown}
      savingMarkdown={savingMarkdown}
    />
  );
}
