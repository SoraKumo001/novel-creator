import {
  buildForeshadowingCategoryTree,
  type ForeshadowingSectionRange,
  findForeshadowingSectionByLine,
} from "@novel-creator/shared";
import { EntityMarkdownEditor } from "./-EntityMarkdownEditor.js";

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
    <EntityMarkdownEditor<ForeshadowingSectionRange>
      novelId={novelId}
      entityTitle="伏線"
      entityType="foreshadowings_document"
      storageKey={`novel-creator:draft:foreshadowings:${novelId}`}
      fetchMarkdown={fetchForeshadowingsMarkdown}
      saveMarkdown={async (md) => {
        const res = await saveForeshadowingsMarkdown(md);
        return {
          created: res.created,
          updated: res.updated,
          deleted: res.deleted,
          duplicateCount: 0,
        };
      }}
      buildTree={buildForeshadowingCategoryTree}
      findSectionAtLine={findForeshadowingSectionByLine}
      savingMarkdown={savingMarkdown}
    />
  );
}
