import { PresetEntityMarkdownEditor } from "./-PresetEntityMarkdownEditor.js";

interface PlotMarkdownEditorProps {
  fetchPlotMarkdown: () => Promise<string>;
  novelId: string;
  savePlotMarkdown: (
    markdown: string
  ) => Promise<{ created?: number; updated?: number; deleted?: number }>;
  savingMarkdown: boolean;
}

export function PlotMarkdownEditor({
  novelId,
  fetchPlotMarkdown,
  savePlotMarkdown,
  savingMarkdown,
}: PlotMarkdownEditorProps) {
  return (
    <PresetEntityMarkdownEditor
      preset="plot"
      novelId={novelId}
      fetchMarkdown={fetchPlotMarkdown}
      saveMarkdown={savePlotMarkdown}
      savingMarkdown={savingMarkdown}
    />
  );
}
