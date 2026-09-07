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
import type { QueryClient } from "@tanstack/react-query";
import { novelKeys } from "@/lib/queryKeys.js";
import {
  fetchCharactersMarkdown,
  fetchForeshadowingsMarkdown,
  fetchPlotMarkdown,
  fetchSettingsMarkdown,
  fetchStoryOutline,
  fetchTimelinesMarkdown,
  saveCharactersMarkdown,
  saveForeshadowingsMarkdown,
  savePlotMarkdown,
  saveSettingsMarkdown,
  saveStoryOutline,
  saveTimelinesMarkdown,
} from "@/lib/services/index.js";
import {
  normalizeProposal,
  type ProposalPayload,
  resolveSafeSectionName,
} from "./proposalTypes.js";

function dispatchUpdate(eventName: string, detail: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

/**
 * 提案を小説データへ反映する（API 層）。
 * 元の ChatProposalCard.handleApply の分岐をそのまま移設したもの。
 * 成功時は適用タイトル（toast 表示用）を返す。
 */
export async function applyProposal(
  targetNovelId: string,
  proposal: ProposalPayload,
  queryClient: QueryClient
): Promise<{ appliedTitle: string }> {
  const { proposalType, data } = proposal;
  const safeSectionName = resolveSafeSectionName(proposal);
  let appliedTitle = proposal.summary || "設定登録提案";

  if (proposalType === "bulk") {
    const {
      characters,
      deleteCharacters: deleteCharactersList,
      deleteSettings: deleteSettingsList,
      foreshadowings,
      settings,
      timelines,
    } = normalizeProposal(data);

    // 人物マークダウンの反映
    if (characters.length > 0 || deleteCharactersList.length > 0) {
      const res = await fetchCharactersMarkdown(targetNovelId).catch(() => ({
        markdown: "",
      }));
      const currentMd = res.markdown ?? "";
      const updatedMd = applyCharactersToMarkdown(
        currentMd,
        characters,
        deleteCharactersList
      );
      await saveCharactersMarkdown(targetNovelId, updatedMd);

      dispatchUpdate("novel-creator:characters-updated", {
        novelId: targetNovelId,
        markdown: updatedMd,
        appliedTitle: "一括登録（人物）",
      });
      await queryClient.invalidateQueries({
        queryKey: novelKeys.characters(targetNovelId),
      });
    }

    // 設定マークダウンの反映
    if (settings.length > 0 || deleteSettingsList.length > 0) {
      const res = await fetchSettingsMarkdown(targetNovelId).catch(() => ({
        markdown: "",
      }));
      const currentMd = res.markdown ?? "";
      const updatedMd = applySettingsToMarkdown(
        currentMd,
        settings,
        deleteSettingsList
      );
      await saveSettingsMarkdown(targetNovelId, updatedMd);

      dispatchUpdate("novel-creator:settings-updated", {
        novelId: targetNovelId,
        markdown: updatedMd,
        appliedTitle: "一括登録（設定）",
      });
      await queryClient.invalidateQueries({
        queryKey: novelKeys.settings(targetNovelId),
      });
    }

    // 伏線マークダウンの反映
    if (foreshadowings.length > 0) {
      const currentMd = await fetchForeshadowingsMarkdown(targetNovelId).catch(
        () => ""
      );
      const updatedMd = applyForeshadowingsToMarkdown(
        currentMd,
        foreshadowings
      );
      await saveForeshadowingsMarkdown(targetNovelId, updatedMd);

      dispatchUpdate("novel-creator:foreshadowings-updated", {
        novelId: targetNovelId,
        markdown: updatedMd,
        appliedTitle: "一括登録（伏線）",
      });
      await queryClient.invalidateQueries({
        queryKey: novelKeys.foreshadowings(targetNovelId),
      });
    }

    // 年表マークダウンの反映
    if (timelines.length > 0) {
      const res = await fetchTimelinesMarkdown(targetNovelId).catch(() => ({
        markdown: "",
      }));
      const currentMd = res.markdown ?? "";
      const updatedMd = applyTimelinesToMarkdown(currentMd, timelines);
      await saveTimelinesMarkdown(targetNovelId, updatedMd);

      dispatchUpdate("novel-creator:timelines-updated", {
        novelId: targetNovelId,
        markdown: updatedMd,
        appliedTitle: "一括登録（年表）",
      });
      await queryClient.invalidateQueries({
        queryKey: novelKeys.timelines(targetNovelId),
      });
    }
  } else if (proposalType === "character") {
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
    await saveCharactersMarkdown(targetNovelId, updatedMd);

    dispatchUpdate("novel-creator:characters-updated", {
      novelId: targetNovelId,
      markdown: updatedMd,
      appliedTitle: data.name,
    });
    await queryClient.invalidateQueries({
      queryKey: novelKeys.characters(targetNovelId),
    });
    appliedTitle = data.name;
  } else if (proposalType === "setting") {
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
    await saveSettingsMarkdown(targetNovelId, updatedMd);

    dispatchUpdate("novel-creator:settings-updated", {
      novelId: targetNovelId,
      markdown: updatedMd,
      appliedTitle: data.name,
    });
    await queryClient.invalidateQueries({
      queryKey: novelKeys.settings(targetNovelId),
    });
    appliedTitle = data.name;
  } else if (proposalType === "delete_setting") {
    const res = await fetchSettingsMarkdown(targetNovelId).catch(() => ({
      markdown: "",
    }));
    const currentMd = res.markdown ?? "";
    const updatedMd = deleteSettingsFromMarkdown(currentMd, [data.name]);
    await saveSettingsMarkdown(targetNovelId, updatedMd);

    dispatchUpdate("novel-creator:settings-updated", {
      novelId: targetNovelId,
      markdown: updatedMd,
      appliedTitle: data.name,
    });
    await queryClient.invalidateQueries({
      queryKey: novelKeys.settings(targetNovelId),
    });
    appliedTitle = data.name;
  } else if (proposalType === "delete_character") {
    const res = await fetchCharactersMarkdown(targetNovelId).catch(() => ({
      markdown: "",
    }));
    const currentMd = res.markdown ?? "";
    const updatedMd = deleteCharactersFromMarkdown(currentMd, [data.name]);
    await saveCharactersMarkdown(targetNovelId, updatedMd);

    dispatchUpdate("novel-creator:characters-updated", {
      novelId: targetNovelId,
      markdown: updatedMd,
      appliedTitle: data.name,
    });
    await queryClient.invalidateQueries({
      queryKey: novelKeys.characters(targetNovelId),
    });
    appliedTitle = data.name;
  } else if (proposalType === "foreshadowing") {
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
    await saveForeshadowingsMarkdown(targetNovelId, updatedMd);

    dispatchUpdate("novel-creator:foreshadowings-updated", {
      novelId: targetNovelId,
      markdown: updatedMd,
      appliedTitle: data.title,
    });
    await queryClient.invalidateQueries({
      queryKey: novelKeys.foreshadowings(targetNovelId),
    });
    appliedTitle = safeTitle;
  } else if (proposalType === "timeline") {
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
    await saveTimelinesMarkdown(targetNovelId, updatedMd);

    dispatchUpdate("novel-creator:timelines-updated", {
      novelId: targetNovelId,
      markdown: updatedMd,
      appliedTitle: data.event,
    });
    await queryClient.invalidateQueries({
      queryKey: novelKeys.timelines(targetNovelId),
    });
    appliedTitle = data.event;
  } else if (proposalType === "plot") {
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
    await savePlotMarkdown(targetNovelId, updatedMd);

    dispatchUpdate("novel-creator:plot-updated", {
      novelId: targetNovelId,
      markdown: updatedMd,
      appliedTitle: chapterTitle,
    });
    await queryClient.invalidateQueries({
      queryKey: novelKeys.chapters(targetNovelId),
    });
    appliedTitle = chapterTitle;
  } else if (proposalType === "story_outline") {
    const currentOutline = await fetchStoryOutline(targetNovelId).catch(
      () => ""
    );
    const sectionName = safeSectionName;
    const content = data.content || "";
    const mode = data.mode || "replace";

    const { updatedMarkdown, appliedSection } = applyStoryOutlineSectionUpdate(
      currentOutline,
      sectionName,
      content,
      mode
    );

    await saveStoryOutline(targetNovelId, updatedMarkdown);

    // 開いているストーリー構想エディタ（Monaco Editor）へ即時反映イベントを発火
    dispatchUpdate("novel-creator:story-outline-updated", {
      novelId: targetNovelId,
      markdown: updatedMarkdown,
      appliedSection,
      mode,
    });
    appliedTitle = sectionName;
  }

  await queryClient.invalidateQueries({
    queryKey: novelKeys.detail(targetNovelId),
  });
  return { appliedTitle };
}
