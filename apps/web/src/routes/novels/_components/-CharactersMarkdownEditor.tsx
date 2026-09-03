import type { SaveCharactersMarkdownResult } from "@/lib/types.js";
import { PresetEntityMarkdownEditor } from "./-PresetEntityMarkdownEditor.js";

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
    <PresetEntityMarkdownEditor
      preset="characters"
      novelId={novelId}
      fetchMarkdown={fetchCharactersMarkdown}
      saveMarkdown={saveCharactersMarkdown}
      savingMarkdown={savingMarkdown}
    />
  );
}
