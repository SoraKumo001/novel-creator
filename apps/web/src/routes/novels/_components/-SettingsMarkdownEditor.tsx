import {
  buildSettingTree,
  findSectionAtLine,
  type SettingSectionRange,
} from "@novel-creator/shared";
import type { SaveSettingsMarkdownResult } from "@/lib/types.js";
import { EntityMarkdownEditor } from "./-EntityMarkdownEditor.js";

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
    <EntityMarkdownEditor<SettingSectionRange>
      novelId={novelId}
      entityTitle="設定"
      entityType="settings_markdown"
      storageKey={`novel-creator:draft:settings:${novelId}`}
      fetchMarkdown={fetchSettingsMarkdown}
      saveMarkdown={saveSettingsMarkdown}
      buildTree={buildSettingTree}
      findSectionAtLine={findSectionAtLine}
      savingMarkdown={savingMarkdown}
    />
  );
}
