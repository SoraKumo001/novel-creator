import {
  buildCharacterTree,
  buildForeshadowingCategoryTree,
  buildPlotCategoryTree,
  buildSettingTree,
  buildTimelineCategoryTree,
  findCharacterAtLine,
  findForeshadowingSectionByLine,
  findPlotSectionByLine,
  findSectionAtLine as findSettingAtLine,
  findTimelineSectionByLine,
  type MarkdownCategoryNode,
} from "@novel-creator/shared";
import { EntityMarkdownEditor } from "./-EntityMarkdownEditor.js";

export type PresetEntityType =
  | "characters"
  | "settings"
  | "foreshadowings"
  | "timelines"
  | "plot";

interface PresetConfig {
  buildTree: (markdown: string) => MarkdownCategoryNode[];
  entityTitle: string;
  entityType:
    | "characters_markdown"
    | "settings_markdown"
    | "foreshadowings_markdown"
    | "timelines_markdown"
    | "plot_markdown";
  findSectionAtLine: (
    markdown: string,
    line: number
  ) => { category: string; name: string } | null;
  storageKeyPrefix: string;
}

const PRESET_CONFIGS: Record<PresetEntityType, PresetConfig> = {
  characters: {
    entityTitle: "人物",
    entityType: "characters_markdown",
    storageKeyPrefix: "novel-creator:draft:characters",
    buildTree: buildCharacterTree,
    findSectionAtLine: findCharacterAtLine,
  },
  settings: {
    entityTitle: "設定",
    entityType: "settings_markdown",
    storageKeyPrefix: "novel-creator:draft:settings",
    buildTree: buildSettingTree,
    findSectionAtLine: findSettingAtLine,
  },
  foreshadowings: {
    entityTitle: "伏線",
    entityType: "foreshadowings_markdown",
    storageKeyPrefix: "novel-creator:draft:foreshadowings",
    buildTree: buildForeshadowingCategoryTree,
    findSectionAtLine: findForeshadowingSectionByLine,
  },
  timelines: {
    entityTitle: "年表",
    entityType: "timelines_markdown",
    storageKeyPrefix: "novel-creator:draft:timelines",
    buildTree: buildTimelineCategoryTree,
    findSectionAtLine: findTimelineSectionByLine,
  },
  plot: {
    entityTitle: "プロット",
    entityType: "plot_markdown",
    storageKeyPrefix: "novel-creator:draft:plot",
    buildTree: buildPlotCategoryTree,
    findSectionAtLine: findPlotSectionByLine,
  },
};

export interface PresetEntityMarkdownEditorProps {
  fetchMarkdown: () => Promise<string>;
  novelId: string;
  preset: PresetEntityType;
  saveMarkdown: (
    markdown: string
  ) => Promise<{ created?: number; updated?: number; deleted?: number }>;
  savingMarkdown: boolean;
}

/**
 * プリセット定義に基づいて EntityMarkdownEditor を描画する共通ラッパー。
 */
export function PresetEntityMarkdownEditor({
  preset,
  novelId,
  fetchMarkdown,
  saveMarkdown,
  savingMarkdown,
}: PresetEntityMarkdownEditorProps) {
  const config = PRESET_CONFIGS[preset];

  return (
    <EntityMarkdownEditor
      novelId={novelId}
      entityTitle={config.entityTitle}
      entityType={config.entityType}
      storageKey={`${config.storageKeyPrefix}:${novelId}`}
      fetchMarkdown={fetchMarkdown}
      saveMarkdown={saveMarkdown}
      buildTree={config.buildTree}
      findSectionAtLine={config.findSectionAtLine}
      savingMarkdown={savingMarkdown}
    />
  );
}
