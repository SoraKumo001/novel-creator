import {
  buildCharacterTree,
  type CharacterSectionRange,
  findCharacterAtLine,
} from "@novel-creator/shared";
import type { SaveCharactersMarkdownResult } from "@/lib/types.js";
import { EntityMarkdownEditor } from "./-EntityMarkdownEditor.js";

interface CharactersMarkdownEditorProps {
  fetchCharactersMarkdown: () => Promise<string>;
  novelId: string;
  saveCharactersMarkdown: (
    markdown: string
  ) => Promise<SaveCharactersMarkdownResult>;
  savingMarkdown: boolean;
}

export function CharactersMarkdownEditor({
  novelId,
  fetchCharactersMarkdown,
  saveCharactersMarkdown,
  savingMarkdown,
}: CharactersMarkdownEditorProps) {
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
      savingMarkdown={savingMarkdown}
    />
  );
}
