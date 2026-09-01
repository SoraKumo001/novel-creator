import {
  buildForeshadowingCategoryTree,
  type ForeshadowingSectionRange,
  findForeshadowingSectionByLine,
  scanForeshadowingSectionRanges,
} from "@novel-creator/shared";
import { useCallback } from "react";
import type { ForeshadowingStatus } from "@/lib/types.js";
import { EntityMarkdownEditor } from "./-EntityMarkdownEditor.js";

interface ForeshadowingsMarkdownEditorProps {
  editForeshadowingDocument: (input: {
    markdown: string;
    instruction: string;
  }) => Promise<string>;
  editForeshadowingSection: (input: {
    category: string;
    title: string;
    description: string;
    status?: ForeshadowingStatus;
    instruction: string;
  }) => Promise<string>;
  editingDocument: boolean;
  editingSection: boolean;
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
  editForeshadowingSection,
  editForeshadowingDocument,
  savingMarkdown,
  editingSection,
  editingDocument,
}: ForeshadowingsMarkdownEditorProps) {
  const handleEditSection = useCallback(
    async ({
      activeSection,
      instruction,
      markdown,
    }: {
      activeSection: ForeshadowingSectionRange;
      instruction: string;
      markdown: string;
    }) => {
      const sections = scanForeshadowingSectionRanges(markdown);
      const target = sections.find(
        (s) =>
          s.category === activeSection.category &&
          s.title === activeSection.title
      );

      if (!target) {
        throw new Error(
          `伏線「${activeSection.title}」のセクションが見つかりません`
        );
      }

      const nextSummary = await editForeshadowingSection({
        category: target.category,
        title: target.title,
        description: target.description,
        status: target.status,
        instruction,
      });

      const lines = markdown.split("\n");
      const before = lines.slice(0, target.startLine);
      const after = lines.slice(target.endLine + 1);
      return [...before, nextSummary.trim(), ...after].join("\n");
    },
    [editForeshadowingSection]
  );

  const handleEditDocument = useCallback(
    async ({
      markdown,
      instruction,
    }: {
      markdown: string;
      instruction: string;
    }) => editForeshadowingDocument({ markdown, instruction }),
    [editForeshadowingDocument]
  );

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
      onEditSection={handleEditSection}
      onEditDocument={handleEditDocument}
      savingMarkdown={savingMarkdown}
      editingSection={editingSection}
      editingDocument={editingDocument}
      sectionPlaceholder={(active: ForeshadowingSectionRange | null) =>
        active
          ? `「${active.title}」への指示（例: 回収時の展開アイデアを追加して）`
          : "カーソルを伏線セクション内に置いてください"
      }
      documentPlaceholder="全体への指示（例: 終盤に向けた主要伏線のカテゴリを整理して）"
    />
  );
}
