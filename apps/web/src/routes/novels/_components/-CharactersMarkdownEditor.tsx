import { useCallback } from 'react';
import {
  buildCharacterTree,
  findCharacterAtLine,
  getCharacterSections,
  type CharacterSectionRange,
} from '@novel-creator/shared';
import type { SaveCharactersMarkdownResult } from '@/lib/types.js';
import { EntityMarkdownEditor } from './-EntityMarkdownEditor.js';

interface CharactersMarkdownEditorProps {
  novelId: string;
  fetchCharactersMarkdown: () => Promise<string>;
  saveCharactersMarkdown: (markdown: string) => Promise<SaveCharactersMarkdownResult>;
  editCharacterSection: (input: {
    category: string;
    name: string;
    description: string;
    traits: string[];
    relationships: string;
    instruction: string;
  }) => Promise<string>;
  editCharacterDocument: (input: { markdown: string; instruction: string }) => Promise<string>;
  savingMarkdown: boolean;
  editingSection: boolean;
  editingDocument: boolean;
}

export function CharactersMarkdownEditor({
  novelId,
  fetchCharactersMarkdown,
  saveCharactersMarkdown,
  editCharacterSection,
  editCharacterDocument,
  savingMarkdown,
  editingSection,
  editingDocument,
}: CharactersMarkdownEditorProps) {
  const handleEditSection = useCallback(
    async ({
      activeSection,
      instruction,
      markdown,
    }: {
      activeSection: CharacterSectionRange;
      instruction: string;
      markdown: string;
    }) => {
      const sections = getCharacterSections(markdown);
      const target = sections.find(
        (s) => s.category === activeSection.category && s.name === activeSection.name,
      );

      if (!target) {
        throw new Error(`人物「${activeSection.name}」のセクションが見つかりません`);
      }

      const nextSummary = await editCharacterSection({
        category: target.category,
        name: target.name,
        description: target.description,
        traits: target.traits,
        relationships: target.relationships,
        instruction,
      });

      const lines = markdown.split('\n');
      const before = lines.slice(0, target.startLine);
      const after = lines.slice(target.endLine + 1);
      return [...before, nextSummary.trim(), ...after].join('\n');
    },
    [editCharacterSection],
  );

  const handleEditDocument = useCallback(
    async ({ markdown, instruction }: { markdown: string; instruction: string }) => {
      return editCharacterDocument({ markdown, instruction });
    },
    [editCharacterDocument],
  );

  return (
    <EntityMarkdownEditor<CharacterSectionRange>
      novelId={novelId}
      entityTitle="人物"
      entityType="characters_markdown"
      storageKey={`novel-creator:draft:characters:${novelId}`}
      fetchMarkdown={fetchCharactersMarkdown}
      saveMarkdown={saveCharactersMarkdown}
      buildTree={buildCharacterTree}
      findSectionAtLine={findCharacterAtLine}
      onEditSection={handleEditSection}
      onEditDocument={handleEditDocument}
      savingMarkdown={savingMarkdown}
      editingSection={editingSection}
      editingDocument={editingDocument}
      sectionPlaceholder={(active: CharacterSectionRange | null) =>
        active
          ? `「${active.name}」への指示（例: 目的を復讐に変更して）`
          : 'カーソルを人物セクション内に置いてください'
      }
      documentPlaceholder="全体への指示（例: 敵対組織の幹部を2名追加して）"
    />
  );
}
