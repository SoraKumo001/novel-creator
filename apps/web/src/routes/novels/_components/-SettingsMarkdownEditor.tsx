import {
  buildSettingTree,
  findSectionAtLine,
  getMarkdownSections,
  type SettingSectionRange,
} from "@novel-creator/shared";
import { useCallback } from "react";
import type { SaveSettingsMarkdownResult } from "@/lib/types.js";
import { EntityMarkdownEditor } from "./-EntityMarkdownEditor.js";

interface SettingsMarkdownEditorProps {
  editingDocument: boolean;
  editingSection: boolean;
  editSettingDocument: (input: {
    markdown: string;
    instruction: string;
  }) => Promise<string>;
  editSettingSection: (input: {
    category: string;
    name: string;
    description: string;
    instruction: string;
  }) => Promise<string>;
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
  editSettingSection,
  editSettingDocument,
  savingMarkdown,
  editingSection,
  editingDocument,
}: SettingsMarkdownEditorProps) {
  const handleEditSection = useCallback(
    async ({
      activeSection,
      instruction,
      markdown,
    }: {
      activeSection: SettingSectionRange;
      instruction: string;
      markdown: string;
    }) => {
      const sections = getMarkdownSections(markdown);
      const target = sections.find(
        (s) =>
          s.category === activeSection.category && s.name === activeSection.name
      );

      if (!target) {
        throw new Error(
          `設定「${activeSection.name}」のセクションが見つかりません`
        );
      }

      const nextSummary = await editSettingSection({
        category: target.category,
        name: target.name,
        description: target.description,
        instruction,
      });

      const lines = markdown.split("\n");
      const before = lines.slice(0, target.startLine);
      const after = lines.slice(target.endLine + 1);
      return [...before, nextSummary.trim(), ...after].join("\n");
    },
    [editSettingSection]
  );

  const handleEditDocument = useCallback(
    async ({
      markdown,
      instruction,
    }: {
      markdown: string;
      instruction: string;
    }) => editSettingDocument({ markdown, instruction }),
    [editSettingDocument]
  );

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
      onEditSection={handleEditSection}
      onEditDocument={handleEditDocument}
      savingMarkdown={savingMarkdown}
      editingSection={editingSection}
      editingDocument={editingDocument}
      sectionPlaceholder={(active: SettingSectionRange | null) =>
        active
          ? `「${active.name}」への指示（例: 魔法体系の制約を追加して）`
          : "カーソルを設定セクション内に置いてください"
      }
      documentPlaceholder="全体への指示（例: 宗教・信仰に関する大項目を追加して）"
    />
  );
}
