import {
  applyCharactersToMarkdown,
  applyForeshadowingsToMarkdown,
  applyPlotToMarkdown,
  applySettingsToMarkdown,
  applyStoryOutlineSectionUpdate,
  applyTimelinesToMarkdown,
  deleteCharactersFromMarkdown,
  deleteSettingsFromMarkdown,
} from "@novel-creator/shared";
import {
  fetchCharactersMarkdown,
  fetchForeshadowingsMarkdown,
  fetchPlotMarkdown,
  fetchSettingsMarkdown,
  fetchStoryOutline,
  fetchTimelinesMarkdown,
} from "@/lib/services/index.js";
import type { DiffTabItem } from "./ProposalDiffModal.js";
import {
  normalizeProposal,
  type ProposalDiffData,
  type ProposalPayload,
  resolveSafeSectionName,
} from "./proposalTypes.js";

/**
 * 提案の差分プレビュー用データを取得する（API 層・読み取りのみ）。
 * 元の ChatProposalCard.handleOpenDiff の分岐をそのまま移設したもの。
 */
export async function buildProposalDiff(
  targetNovelId: string,
  proposal: ProposalPayload
): Promise<ProposalDiffData | null> {
  const { proposalType, data } = proposal;
  const safeSectionName = resolveSafeSectionName(proposal);

  if (proposalType === "story_outline") {
    const currentOutline = await fetchStoryOutline(targetNovelId).catch(
      () => ""
    );
    const sectionName = safeSectionName;
    const content = data.content || "";
    const mode = data.mode || "replace";
    const { updatedMarkdown } = applyStoryOutlineSectionUpdate(
      currentOutline,
      sectionName,
      content,
      mode
    );
    return {
      title: `ストーリー構想「${safeSectionName}」`,
      targetTab: "outline",
      entityType: "story_outline_markdown",
      originalMarkdown: currentOutline,
      updatedMarkdown,
    };
  }
  if (proposalType === "character") {
    const res = await fetchCharactersMarkdown(targetNovelId).catch(() => ({
      markdown: "",
    }));
    const currentMd = res.markdown ?? "";
    const deleteNames = data.oldCharacterName ? [data.oldCharacterName] : [];
    const updatedMd = applyCharactersToMarkdown(
      currentMd,
      [
        {
          name: data.name,
          category: data.category,
          description: data.description,
          traits: data.traits,
        },
      ],
      deleteNames
    );
    return {
      title: data.oldCharacterName
        ? `登場人物「${data.name}」（旧「${data.oldCharacterName}」置換）`
        : `登場人物「${data.name}」`,
      targetTab: "characters",
      entityType: "characters_markdown",
      originalMarkdown: currentMd,
      updatedMarkdown: updatedMd,
    };
  }
  if (proposalType === "setting") {
    const res = await fetchSettingsMarkdown(targetNovelId).catch(() => ({
      markdown: "",
    }));
    const currentMd = res.markdown ?? "";
    const deleteNames = data.oldSettingName ? [data.oldSettingName] : [];
    const updatedMd = applySettingsToMarkdown(
      currentMd,
      [
        {
          name: data.name,
          category: data.category,
          description: data.description,
        },
      ],
      deleteNames
    );
    return {
      title: data.oldSettingName
        ? `世界観・設定「${data.name}」（旧「${data.oldSettingName}」置換）`
        : `世界観・設定「${data.name}」`,
      targetTab: "settings",
      entityType: "settings_markdown",
      originalMarkdown: currentMd,
      updatedMarkdown: updatedMd,
    };
  }
  if (proposalType === "delete_setting") {
    const res = await fetchSettingsMarkdown(targetNovelId).catch(() => ({
      markdown: "",
    }));
    const currentMd = res.markdown ?? "";
    const updatedMd = deleteSettingsFromMarkdown(currentMd, [data.name]);
    return {
      title: `世界観・設定「${data.name}」（削除）`,
      targetTab: "settings",
      entityType: "settings_markdown",
      originalMarkdown: currentMd,
      updatedMarkdown: updatedMd,
    };
  }
  if (proposalType === "delete_character") {
    const res = await fetchCharactersMarkdown(targetNovelId).catch(() => ({
      markdown: "",
    }));
    const currentMd = res.markdown ?? "";
    const updatedMd = deleteCharactersFromMarkdown(currentMd, [data.name]);
    return {
      title: `登場人物「${data.name}」（削除）`,
      targetTab: "characters",
      entityType: "characters_markdown",
      originalMarkdown: currentMd,
      updatedMarkdown: updatedMd,
    };
  }
  if (proposalType === "foreshadowing") {
    const currentMd = await fetchForeshadowingsMarkdown(targetNovelId).catch(
      () => ""
    );
    const safeTitle = (
      data.title ||
      data.name ||
      data.description?.slice(0, 30) ||
      "無題の伏線"
    ).trim();
    const updatedMd = applyForeshadowingsToMarkdown(currentMd, [
      {
        title: safeTitle,
        description: data.description,
        status: data.status || "unresolved",
        category: data.category,
      },
    ]);
    return {
      title: `伏線「${safeTitle}」`,
      targetTab: "foreshadowings",
      entityType: "foreshadowings_markdown",
      originalMarkdown: currentMd,
      updatedMarkdown: updatedMd,
    };
  }
  if (proposalType === "timeline") {
    const res = await fetchTimelinesMarkdown(targetNovelId).catch(() => ({
      markdown: "",
    }));
    const currentMd = res.markdown ?? "";
    const updatedMd = applyTimelinesToMarkdown(currentMd, [
      {
        event: data.event,
        timestamp: data.timestamp,
        order: data.order,
      },
    ]);
    return {
      title: `年表「${data.event}」`,
      targetTab: "timeline",
      entityType: "timelines_markdown",
      originalMarkdown: currentMd,
      updatedMarkdown: updatedMd,
    };
  }
  if (proposalType === "plot") {
    const res = await fetchPlotMarkdown(targetNovelId).catch(() => ({
      markdown: "",
    }));
    const currentMd = res.markdown ?? "";
    const chapterTitle = data.chapterTitle || data.title;
    const updatedMd = applyPlotToMarkdown(currentMd, [
      {
        title: chapterTitle,
        summary: data.summary,
      },
    ]);
    return {
      title: `プロット「${chapterTitle}」`,
      targetTab: "plot",
      entityType: "plot_markdown",
      originalMarkdown: currentMd,
      updatedMarkdown: updatedMd,
    };
  }
  if (proposalType === "bulk") {
    const {
      characters,
      deleteCharacters: delChars,
      deleteSettings: delSets,
      foreshadowings,
      settings,
      timelines,
    } = normalizeProposal(data);

    const items: DiffTabItem[] = [];

    // 1. 登場人物
    if (characters.length > 0 || delChars.length > 0) {
      const res = await fetchCharactersMarkdown(targetNovelId).catch(() => ({
        markdown: "",
      }));
      const currentMd = res.markdown ?? "";
      const updatedMd = applyCharactersToMarkdown(
        currentMd,
        characters,
        delChars
      );
      items.push({
        id: "characters",
        label: `🎭 登場人物 (${characters.length}名${delChars.length > 0 ? ` / 削除${delChars.length}名` : ""})`,
        title: `登場人物（一括 反映 ${characters.length}名 / 削除 ${delChars.length}名）`,
        targetTab: "characters",
        entityType: "characters_markdown",
        originalMarkdown: currentMd,
        updatedMarkdown: updatedMd,
      });
    }

    // 2. 世界観・設定
    if (settings.length > 0 || delSets.length > 0) {
      const res = await fetchSettingsMarkdown(targetNovelId).catch(() => ({
        markdown: "",
      }));
      const currentMd = res.markdown ?? "";
      const updatedMd = applySettingsToMarkdown(currentMd, settings, delSets);
      items.push({
        id: "settings",
        label: `🌍 設定 (${settings.length}件${delSets.length > 0 ? ` / 削除${delSets.length}件` : ""})`,
        title: `世界観・設定（一括 反映 ${settings.length}件 / 削除 ${delSets.length}件）`,
        targetTab: "settings",
        entityType: "settings_markdown",
        originalMarkdown: currentMd,
        updatedMarkdown: updatedMd,
      });
    }

    // 3. 伏線
    if (foreshadowings.length > 0) {
      const currentMd = await fetchForeshadowingsMarkdown(targetNovelId).catch(
        () => ""
      );
      const updatedMd = applyForeshadowingsToMarkdown(
        currentMd,
        foreshadowings
      );
      items.push({
        id: "foreshadowings",
        label: `🔍 伏線 (${foreshadowings.length}件)`,
        title: `伏線（一括 反映 ${foreshadowings.length}件）`,
        targetTab: "foreshadowings",
        entityType: "foreshadowings_markdown",
        originalMarkdown: currentMd,
        updatedMarkdown: updatedMd,
      });
    }

    // 4. 年表
    if (timelines.length > 0) {
      const res = await fetchTimelinesMarkdown(targetNovelId).catch(() => ({
        markdown: "",
      }));
      const currentMd = res.markdown ?? "";
      const updatedMd = applyTimelinesToMarkdown(currentMd, timelines);
      items.push({
        id: "timelines",
        label: `⏳ 年表 (${timelines.length}件)`,
        title: `年表（一括 反映 ${timelines.length}件）`,
        targetTab: "timeline",
        entityType: "timelines_markdown",
        originalMarkdown: currentMd,
        updatedMarkdown: updatedMd,
      });
    }

    if (items.length > 0) {
      return {
        title: items[0].title,
        targetTab: items[0].targetTab,
        entityType: items[0].entityType,
        originalMarkdown: items[0].originalMarkdown,
        updatedMarkdown: items[0].updatedMarkdown,
        diffItems: items,
      };
    }
    return null;
  }
  return null;
}
