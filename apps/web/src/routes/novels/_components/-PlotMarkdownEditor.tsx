import {
  buildPlotCategoryTree,
  findPlotSectionByLine,
  type PlotSectionRange,
} from "@novel-creator/shared";
import { EntityMarkdownEditor } from "./-EntityMarkdownEditor.js";

interface PlotMarkdownEditorProps {
  fetchPlotMarkdown: () => Promise<string>;
  novelId: string;
  savePlotMarkdown: (
    markdown: string
  ) => Promise<{ created: number; deleted: number; updated: number }>;
  savingMarkdown: boolean;
}

export function PlotMarkdownEditor({
  novelId,
  fetchPlotMarkdown,
  savePlotMarkdown,
  savingMarkdown,
}: PlotMarkdownEditorProps) {
  return (
    <EntityMarkdownEditor<PlotSectionRange>
      novelId={novelId}
      entityTitle="プロット"
      entityType="plot_markdown"
      storageKey={`novel-creator:draft:plot:${novelId}`}
      fetchMarkdown={fetchPlotMarkdown}
      saveMarkdown={savePlotMarkdown}
      buildTree={buildPlotCategoryTree}
      findSectionAtLine={findPlotSectionByLine}
      savingMarkdown={savingMarkdown}
    />
  );
}
