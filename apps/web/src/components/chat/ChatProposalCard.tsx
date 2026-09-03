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
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useContext, useState } from "react";
import { Button } from "@/components/Button.js";
import { ChatUIContext } from "@/context/ChatContext.js";
import { useToast } from "@/hooks/useToast.js";
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
import { type DiffTabItem, ProposalDiffModal } from "./ProposalDiffModal.js";

/** ストーリー構想の更新モード */
type StoryOutlineMode = "append" | "full_document" | "prepend" | "replace";

/** 伏線のステータス */
type ForeshadowingStatus = "abandoned" | "resolved" | "unresolved";

/** 一括登録（bulk）の登場人物アイテム。LLM ツール出力のため title 表記の揺れを許容する */
interface BulkCharacterItem {
  category?: string;
  description?: string;
  name?: string;
  title?: string;
  traits?: string[];
}

/** 一括登録（bulk）の世界観・設定アイテム */
interface BulkSettingItem {
  category?: string;
  description?: string;
  name?: string;
  title?: string;
}

/** 一括登録（bulk）の伏線アイテム（title が無く name / description のみのケースを許容） */
interface BulkForeshadowingItem {
  category?: string;
  description?: string;
  name?: string;
  status?: ForeshadowingStatus;
  title?: string;
}

/** 一括登録（bulk）の年表イベントアイテム */
interface BulkTimelineItem {
  event?: string;
  timestamp?: string | null;
  title?: string;
}

/**
 * 提案ペイロードの data 部。
 * バックエンドの proposeTools（apps/api/src/core/tools/proposeTools.ts）が返す形状を
 * 元にした、フロント側の防御的・最小限の型。reason / sectionName / mode は
 * 一部の提案タイプ（story_outline / delete_*）でのみ使われるが、カード上部の
 * 共通表示ロジックが安全に読めるよう基底に持たせる。
 */
interface ProposalDataBase {
  /** ストーリー構想の更新モード */
  mode?: StoryOutlineMode;
  /** 登録・削除・更新の理由（あれば） */
  reason?: string | null;
  /** ストーリー構想（story_outline）の対象セクション名 */
  sectionName?: string;
}

interface BulkProposalData extends ProposalDataBase {
  characters?: BulkCharacterItem[];
  deleteCharacters?: string[];
  deleteSettings?: string[];
  foreshadowings?: BulkForeshadowingItem[];
  settings?: BulkSettingItem[];
  timelines?: BulkTimelineItem[];
}

interface CharacterProposalData extends ProposalDataBase {
  category?: string;
  description?: string;
  name: string;
  oldCharacterName?: string | null;
  traits?: string[];
}

interface SettingProposalData extends ProposalDataBase {
  category?: string;
  description?: string;
  name: string;
  oldSettingName?: string | null;
}

interface DeleteProposalData extends ProposalDataBase {
  name: string;
}

interface ForeshadowingProposalData extends ProposalDataBase {
  category?: string;
  description?: string;
  name?: string;
  status?: ForeshadowingStatus;
  title: string;
}

interface TimelineProposalData extends ProposalDataBase {
  event: string;
  order?: number | null;
  timestamp?: string | null;
}

interface PlotProposalData extends ProposalDataBase {
  chapterTitle: string;
  summary: string;
  /** LLM 出力の表記ゆれ（title）も許容する防御的フィールド */
  title: string;
}

interface StoryOutlineProposalData extends ProposalDataBase {
  content?: string;
}

interface ProposalPayloadBase {
  novelId: string;
  reason?: string;
  sectionName?: string;
  summary: string;
  type: "proposal";
}

export type ProposalPayload =
  | (ProposalPayloadBase & {
      data: BulkProposalData;
      proposalType: "bulk";
    })
  | (ProposalPayloadBase & {
      data: CharacterProposalData;
      proposalType: "character";
    })
  | (ProposalPayloadBase & {
      data: DeleteProposalData;
      proposalType: "delete_character";
    })
  | (ProposalPayloadBase & {
      data: DeleteProposalData;
      proposalType: "delete_setting";
    })
  | (ProposalPayloadBase & {
      data: ForeshadowingProposalData;
      proposalType: "foreshadowing";
    })
  | (ProposalPayloadBase & {
      data: PlotProposalData;
      proposalType: "plot";
    })
  | (ProposalPayloadBase & {
      data: SettingProposalData;
      proposalType: "setting";
    })
  | (ProposalPayloadBase & {
      data: StoryOutlineProposalData;
      proposalType: "story_outline";
    })
  | (ProposalPayloadBase & {
      data: TimelineProposalData;
      proposalType: "timeline";
    });

/** normalizeProposal() が返す正規化済み一括データ */
interface NormalizedBulkProposal {
  characters: (BulkCharacterItem & { name: string })[];
  deleteCharacters: string[];
  deleteSettings: string[];
  foreshadowings: (BulkForeshadowingItem & { title: string })[];
  settings: (BulkSettingItem & { name: string })[];
  timelines: (BulkTimelineItem & { event: string })[];
}

/**
 * 一括提案（bulk）の data を反映処理と差分プレビューで共通利用する形状へ正規化する。
 * LLM ツール出力は name|title などの表記ゆれがあるため、安全な既定値を補完して
 * 空配列に倒し込む（handleApply / handleOpenDiff の両方が同じ変換を使う）。
 */
function normalizeProposal(data: BulkProposalData): NormalizedBulkProposal {
  const characters = (
    Array.isArray(data.characters) ? data.characters : []
  ).map((c) => ({
    ...c,
    name: (c.name || c.title || "無題の登場人物").trim(),
  }));
  const settings = (Array.isArray(data.settings) ? data.settings : []).map(
    (s) => ({
      ...s,
      name: (s.name || s.title || "無題の設定").trim(),
    })
  );
  const foreshadowings = (
    Array.isArray(data.foreshadowings) ? data.foreshadowings : []
  ).map((f) => ({
    ...f,
    title: (
      f.title ||
      f.name ||
      f.description?.slice(0, 30) ||
      "無題の伏線"
    ).trim(),
  }));
  const timelines = (Array.isArray(data.timelines) ? data.timelines : []).map(
    (t) => ({
      ...t,
      event: (t.event || t.title || "無題の出来事").trim(),
    })
  );
  const deleteSettings: string[] = Array.isArray(data.deleteSettings)
    ? data.deleteSettings.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  const deleteCharacters: string[] = Array.isArray(data.deleteCharacters)
    ? data.deleteCharacters.map((c) => String(c || "").trim()).filter(Boolean)
    : [];
  return {
    characters,
    deleteCharacters,
    deleteSettings,
    foreshadowings,
    settings,
    timelines,
  };
}

/** /novels/$novelId ルートの search.tab が受け付けるタブID */
type NovelRouteTabId =
  | "characters"
  | "editor"
  | "foreshadowing"
  | "outline"
  | "overview"
  | "plot"
  | "settings"
  | "timeline";

/**
 * DiffTabItem.targetTab（例: "foreshadowings"）はルートの search.tab のタブID
 * （例: "foreshadowing"）と表記ゆれがあるため、型がそのまま一致しない。
 * ルーター側の validateSearch が未知の値は undefined に正規化するため、
 * ここでは型合わせのための変換のみを行う（値はそのまま渡す）。
 */
function toRouteTab(tab: string): NovelRouteTabId {
  return tab as NovelRouteTabId;
}

interface ChatProposalCardProps {
  proposal: ProposalPayload;
}

export function ChatProposalCard({ proposal }: ChatProposalCardProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const chatUI = useContext(ChatUIContext);
  const navigate = useNavigate();

  const [status, setStatus] = useState<"pending" | "applied" | "dismissed">(
    "pending"
  );
  const [isApplying, setIsApplying] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffData, setDiffData] = useState<{
    diffItems?: DiffTabItem[];
    entityType: string;
    originalMarkdown: string;
    targetTab: string;
    title: string;
    updatedMarkdown: string;
  } | null>(null);

  const { proposalType, data, summary } = proposal;

  const rawNovelId = proposal.novelId;
  const targetNovelId =
    typeof rawNovelId === "string" &&
    rawNovelId.trim() &&
    rawNovelId !== "undefined" &&
    rawNovelId !== "null"
      ? rawNovelId.trim()
      : chatUI?.selectedNovelId?.trim() || "";

  const rawSectionName = data.sectionName;
  const safeSectionName =
    typeof rawSectionName === "string" &&
    rawSectionName.trim() &&
    rawSectionName !== "undefined"
      ? rawSectionName.trim()
      : data.mode === "full_document"
        ? "ドキュメント全体"
        : "全体あらすじ";

  const cleanSummary =
    summary && !summary.includes("undefined")
      ? summary
      : proposalType === "story_outline"
        ? `ストーリー構想「${safeSectionName}」の更新提案${data.reason ? `（${data.reason}）` : ""}`
        : summary || "設定登録提案";

  const handleApply = async () => {
    if (!targetNovelId) {
      toast.error(
        "反映対象の小説が未選択です。上部の「対象」セレクターから小説を選択してください。"
      );
      return;
    }
    setIsApplying(true);
    try {
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
          const res = await fetchCharactersMarkdown(targetNovelId).catch(
            () => ({ markdown: "" })
          );
          const currentMd = res.markdown ?? "";
          const updatedMd = applyCharactersToMarkdown(
            currentMd,
            characters,
            deleteCharactersList
          );
          await saveCharactersMarkdown(targetNovelId, updatedMd);

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("novel-creator:characters-updated", {
                detail: {
                  novelId: targetNovelId,
                  markdown: updatedMd,
                  appliedTitle: "一括登録（人物）",
                },
              })
            );
          }
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

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("novel-creator:settings-updated", {
                detail: {
                  novelId: targetNovelId,
                  markdown: updatedMd,
                  appliedTitle: "一括登録（設定）",
                },
              })
            );
          }
          await queryClient.invalidateQueries({
            queryKey: novelKeys.settings(targetNovelId),
          });
        }

        // 伏線マークダウンの反映
        if (foreshadowings.length > 0) {
          const currentMd = await fetchForeshadowingsMarkdown(
            targetNovelId
          ).catch(() => "");
          const updatedMd = applyForeshadowingsToMarkdown(
            currentMd,
            foreshadowings
          );
          await saveForeshadowingsMarkdown(targetNovelId, updatedMd);

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("novel-creator:foreshadowings-updated", {
                detail: {
                  novelId: targetNovelId,
                  markdown: updatedMd,
                  appliedTitle: "一括登録（伏線）",
                },
              })
            );
          }
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

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("novel-creator:timelines-updated", {
                detail: {
                  novelId: targetNovelId,
                  markdown: updatedMd,
                  appliedTitle: "一括登録（年表）",
                },
              })
            );
          }
          await queryClient.invalidateQueries({
            queryKey: novelKeys.timelines(targetNovelId),
          });
        }
      } else if (proposalType === "character") {
        const res = await fetchCharactersMarkdown(targetNovelId).catch(() => ({
          markdown: "",
        }));
        const currentMd = res.markdown ?? "";
        const deleteNames = data.oldCharacterName
          ? [data.oldCharacterName]
          : [];
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

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("novel-creator:characters-updated", {
              detail: {
                novelId: targetNovelId,
                markdown: updatedMd,
                appliedTitle: data.name,
              },
            })
          );
        }
        await queryClient.invalidateQueries({
          queryKey: novelKeys.characters(targetNovelId),
        });
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

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("novel-creator:settings-updated", {
              detail: {
                novelId: targetNovelId,
                markdown: updatedMd,
                appliedTitle: data.name,
              },
            })
          );
        }
        await queryClient.invalidateQueries({
          queryKey: novelKeys.settings(targetNovelId),
        });
      } else if (proposalType === "delete_setting") {
        const res = await fetchSettingsMarkdown(targetNovelId).catch(() => ({
          markdown: "",
        }));
        const currentMd = res.markdown ?? "";
        const updatedMd = deleteSettingsFromMarkdown(currentMd, [data.name]);
        await saveSettingsMarkdown(targetNovelId, updatedMd);

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("novel-creator:settings-updated", {
              detail: {
                novelId: targetNovelId,
                markdown: updatedMd,
                appliedTitle: data.name,
              },
            })
          );
        }
        await queryClient.invalidateQueries({
          queryKey: novelKeys.settings(targetNovelId),
        });
      } else if (proposalType === "delete_character") {
        const res = await fetchCharactersMarkdown(targetNovelId).catch(() => ({
          markdown: "",
        }));
        const currentMd = res.markdown ?? "";
        const updatedMd = deleteCharactersFromMarkdown(currentMd, [data.name]);
        await saveCharactersMarkdown(targetNovelId, updatedMd);

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("novel-creator:characters-updated", {
              detail: {
                novelId: targetNovelId,
                markdown: updatedMd,
                appliedTitle: data.name,
              },
            })
          );
        }
        await queryClient.invalidateQueries({
          queryKey: novelKeys.characters(targetNovelId),
        });
      } else if (proposalType === "foreshadowing") {
        const currentMd = await fetchForeshadowingsMarkdown(
          targetNovelId
        ).catch(() => "");
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

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("novel-creator:foreshadowings-updated", {
              detail: {
                novelId: targetNovelId,
                markdown: updatedMd,
                appliedTitle: data.title,
              },
            })
          );
        }
        await queryClient.invalidateQueries({
          queryKey: novelKeys.foreshadowings(targetNovelId),
        });
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

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("novel-creator:timelines-updated", {
              detail: {
                novelId: targetNovelId,
                markdown: updatedMd,
                appliedTitle: data.event,
              },
            })
          );
        }
        await queryClient.invalidateQueries({
          queryKey: novelKeys.timelines(targetNovelId),
        });
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

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("novel-creator:plot-updated", {
              detail: {
                novelId: targetNovelId,
                markdown: updatedMd,
                appliedTitle: chapterTitle,
              },
            })
          );
        }
        await queryClient.invalidateQueries({
          queryKey: novelKeys.chapters(targetNovelId),
        });
      } else if (proposalType === "story_outline") {
        const currentOutline = await fetchStoryOutline(targetNovelId).catch(
          () => ""
        );
        const sectionName = safeSectionName;
        const content = data.content || "";
        const mode = data.mode || "replace";

        const { updatedMarkdown, appliedSection } =
          applyStoryOutlineSectionUpdate(
            currentOutline,
            sectionName,
            content,
            mode
          );

        await saveStoryOutline(targetNovelId, updatedMarkdown);

        // 開いているストーリー構想エディタ（Monaco Editor）へ即時反映イベントを発火
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("novel-creator:story-outline-updated", {
              detail: {
                novelId: targetNovelId,
                markdown: updatedMarkdown,
                appliedSection,
                mode,
              },
            })
          );
        }
      }

      await queryClient.invalidateQueries({
        queryKey: novelKeys.detail(targetNovelId),
      });
      setStatus("applied");
      setDiffModalOpen(false);
      toast.success(`${cleanSummary}を小説データに反映しました`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "反映に失敗しました";
      toast.error(msg);
    } finally {
      setIsApplying(false);
    }
  };

  const canShowDiff =
    proposalType === "story_outline" ||
    proposalType === "character" ||
    proposalType === "setting" ||
    proposalType === "delete_setting" ||
    proposalType === "delete_character" ||
    proposalType === "foreshadowing" ||
    proposalType === "timeline" ||
    proposalType === "plot" ||
    (proposalType === "bulk" &&
      ((Array.isArray(data.characters) && data.characters.length > 0) ||
        (Array.isArray(data.settings) && data.settings.length > 0) ||
        (Array.isArray(data.foreshadowings) &&
          data.foreshadowings.length > 0) ||
        (Array.isArray(data.timelines) && data.timelines.length > 0) ||
        (Array.isArray(data.deleteSettings) &&
          data.deleteSettings.length > 0) ||
        (Array.isArray(data.deleteCharacters) &&
          data.deleteCharacters.length > 0)));

  const handleOpenDiff = async () => {
    if (!targetNovelId) {
      toast.error(
        "反映対象の小説が未選択です。上部の「対象」セレクターから小説を選択してください。"
      );
      return;
    }
    setDiffLoading(true);
    try {
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
        setDiffData({
          title: `ストーリー構想「${safeSectionName}」`,
          targetTab: "outline",
          entityType: "story_outline_markdown",
          originalMarkdown: currentOutline,
          updatedMarkdown,
        });
        setDiffModalOpen(true);
      } else if (proposalType === "character") {
        const res = await fetchCharactersMarkdown(targetNovelId).catch(() => ({
          markdown: "",
        }));
        const currentMd = res.markdown ?? "";
        const deleteNames = data.oldCharacterName
          ? [data.oldCharacterName]
          : [];
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
        setDiffData({
          title: data.oldCharacterName
            ? `登場人物「${data.name}」（旧「${data.oldCharacterName}」置換）`
            : `登場人物「${data.name}」`,
          targetTab: "characters",
          entityType: "characters_markdown",
          originalMarkdown: currentMd,
          updatedMarkdown: updatedMd,
        });
        setDiffModalOpen(true);
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
        setDiffData({
          title: data.oldSettingName
            ? `世界観・設定「${data.name}」（旧「${data.oldSettingName}」置換）`
            : `世界観・設定「${data.name}」`,
          targetTab: "settings",
          entityType: "settings_markdown",
          originalMarkdown: currentMd,
          updatedMarkdown: updatedMd,
        });
        setDiffModalOpen(true);
      } else if (proposalType === "delete_setting") {
        const res = await fetchSettingsMarkdown(targetNovelId).catch(() => ({
          markdown: "",
        }));
        const currentMd = res.markdown ?? "";
        const updatedMd = deleteSettingsFromMarkdown(currentMd, [data.name]);
        setDiffData({
          title: `世界観・設定「${data.name}」（削除）`,
          targetTab: "settings",
          entityType: "settings_markdown",
          originalMarkdown: currentMd,
          updatedMarkdown: updatedMd,
        });
        setDiffModalOpen(true);
      } else if (proposalType === "delete_character") {
        const res = await fetchCharactersMarkdown(targetNovelId).catch(() => ({
          markdown: "",
        }));
        const currentMd = res.markdown ?? "";
        const updatedMd = deleteCharactersFromMarkdown(currentMd, [data.name]);
        setDiffData({
          title: `登場人物「${data.name}」（削除）`,
          targetTab: "characters",
          entityType: "characters_markdown",
          originalMarkdown: currentMd,
          updatedMarkdown: updatedMd,
        });
        setDiffModalOpen(true);
      } else if (proposalType === "foreshadowing") {
        const currentMd = await fetchForeshadowingsMarkdown(
          targetNovelId
        ).catch(() => "");
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
        setDiffData({
          title: `伏線「${safeTitle}」`,
          targetTab: "foreshadowings",
          entityType: "foreshadowings_markdown",
          originalMarkdown: currentMd,
          updatedMarkdown: updatedMd,
        });
        setDiffModalOpen(true);
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
        setDiffData({
          title: `年表「${data.event}」`,
          targetTab: "timeline",
          entityType: "timelines_markdown",
          originalMarkdown: currentMd,
          updatedMarkdown: updatedMd,
        });
        setDiffModalOpen(true);
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
        setDiffData({
          title: `プロット「${chapterTitle}」`,
          targetTab: "plot",
          entityType: "plot_markdown",
          originalMarkdown: currentMd,
          updatedMarkdown: updatedMd,
        });
        setDiffModalOpen(true);
      } else if (proposalType === "bulk") {
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
          const res = await fetchCharactersMarkdown(targetNovelId).catch(
            () => ({ markdown: "" })
          );
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
          const updatedMd = applySettingsToMarkdown(
            currentMd,
            settings,
            delSets
          );
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
          const currentMd = await fetchForeshadowingsMarkdown(
            targetNovelId
          ).catch(() => "");
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
          setDiffData({
            title: items[0].title,
            targetTab: items[0].targetTab,
            entityType: items[0].entityType,
            originalMarkdown: items[0].originalMarkdown,
            updatedMarkdown: items[0].updatedMarkdown,
            diffItems: items,
          });
          setDiffModalOpen(true);
        } else {
          toast.error("差分プレビュー可能な項目がありません");
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "差分データの取得に失敗しました"
      );
    } finally {
      setDiffLoading(false);
    }
  };

  const handleOpenInEditor = (targetTabOverride?: string) => {
    if (!diffData || !targetNovelId) {
      return;
    }
    setDiffModalOpen(false);

    // タブ指定があれば一致するアイテムから詳細情報を取得
    const targetItem = diffData.diffItems?.find(
      (item) => item.targetTab === targetTabOverride
    );
    const resolvedTab = targetTabOverride || diffData.targetTab;
    const resolvedEntityType = targetItem?.entityType || diffData.entityType;
    const resolvedMarkdown =
      targetItem?.updatedMarkdown || diffData.updatedMarkdown;
    const resolvedTitle = targetItem?.title || diffData.title;

    // 該当タブに遷移
    navigate({
      to: "/novels/$novelId",
      params: { novelId: targetNovelId },
      search: { tab: toRouteTab(resolvedTab) },
    });

    // 遷移後のエディタに提案適用後Markdownを渡すイベントを発火
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("novel-creator:markdown-preview-apply", {
            detail: {
              novelId: targetNovelId,
              entityType: resolvedEntityType,
              markdown: resolvedMarkdown,
              appliedTitle: resolvedTitle,
            },
          })
        );
      }
    }, 150);
  };

  const isApplied = status === "applied";
  const isDismissed = status === "dismissed";

  const typeBadges: Record<string, { label: string; bg: string }> = {
    bulk: {
      label: "📦 一括登録",
      bg: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
    },
    character: {
      label: "👤 登場人物",
      bg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
    },
    setting: {
      label: "🌍 世界観・設定",
      bg: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
    },
    delete_setting: {
      label: "🗑️ 設定削除",
      bg: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    },
    delete_character: {
      label: "🗑️ 人物削除",
      bg: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    },
    foreshadowing: {
      label: "🔍 伏線",
      bg: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    },
    timeline: {
      label: "⏳ 年表イベント",
      bg: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    },
    plot: {
      label: "📖 プロット",
      bg: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
    },
    story_outline: {
      label: "🗺️ ストーリー構想",
      bg: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    },
  };

  const badge = typeBadges[proposalType] || {
    label: "💡 設定提案",
    bg: "bg-slate-100 text-slate-800",
  };

  const isDeleteOnly =
    proposalType === "delete_setting" || proposalType === "delete_character";

  const cardBorderClass = isApplied
    ? "border-emerald-300 bg-linear-to-br from-emerald-50/90 to-teal-50/40 dark:border-emerald-800/80 dark:from-emerald-950/30 dark:to-teal-950/20"
    : isDismissed
      ? "border-slate-200 bg-slate-50/60 opacity-60 dark:border-slate-800 dark:bg-slate-900/30"
      : isDeleteOnly
        ? "border-rose-200 bg-linear-to-br from-rose-50/90 to-amber-50/40 dark:border-rose-900/60 dark:from-rose-950/30 dark:to-amber-950/20"
        : "border-indigo-200 bg-linear-to-br from-indigo-50/90 to-purple-50/40 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-purple-950/20";

  return (
    <div
      className={`my-3 overflow-hidden rounded-xl border p-3 shadow-xs transition ${cardBorderClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">
            {isApplied ? "✔" : isDeleteOnly ? "🗑️" : "💡"}
          </span>
          <span className="font-bold text-slate-800 text-xs dark:text-slate-200">
            {isApplied
              ? "小説データに反映完了"
              : isDeleteOnly
                ? "設定削除の提案"
                : "設定反映の提案"}
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 font-semibold text-[10px] ${badge.bg}`}
          >
            {badge.label}
          </span>
        </div>

        {isApplied ? (
          <span className="flex items-center gap-1 font-semibold text-[11px] text-emerald-700 dark:text-emerald-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            <span>反映済み</span>
          </span>
        ) : isDismissed ? (
          <span className="font-medium text-[11px] text-slate-400">
            スキップ済み
          </span>
        ) : (
          <span
            className={`font-medium text-[11px] ${
              isDeleteOnly
                ? "text-rose-700 dark:text-rose-400"
                : "text-indigo-700 dark:text-indigo-400"
            }`}
          >
            {isDeleteOnly ? "ワンクリックで削除実行" : "ワンクリックで登録可能"}
          </span>
        )}
      </div>

      <div className="mt-2.5 rounded-lg border border-indigo-100/70 bg-white/90 p-2.5 text-slate-700 text-xs shadow-2xs dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
        {proposalType === "bulk" && (
          <div className="space-y-2">
            {(!Array.isArray(data.characters) ||
              data.characters.length === 0) &&
              (!Array.isArray(data.settings) || data.settings.length === 0) &&
              (!Array.isArray(data.foreshadowings) ||
                data.foreshadowings.length === 0) &&
              (!Array.isArray(data.timelines) || data.timelines.length === 0) &&
              (!Array.isArray(data.deleteSettings) ||
                data.deleteSettings.length === 0) &&
              (!Array.isArray(data.deleteCharacters) ||
                data.deleteCharacters.length === 0) && (
                <div className="py-1 text-slate-500 text-xs">
                  （登録・削除対象の項目はありません）
                </div>
              )}
            {Array.isArray(data.deleteSettings) &&
              data.deleteSettings.length > 0 && (
                <div className="rounded border border-rose-200 bg-rose-50/60 p-2 text-xs dark:border-rose-900/40 dark:bg-rose-950/20">
                  <div className="font-bold text-[11px] text-rose-700 dark:text-rose-400">
                    🗑️ 削除対象の世界観・設定 ({data.deleteSettings.length}件)
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.deleteSettings.map((name: string, i: number) => (
                      <span
                        key={i}
                        className="rounded bg-rose-100 px-1.5 py-0.5 font-medium text-[10px] text-rose-800 line-through dark:bg-rose-900/60 dark:text-rose-300"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            {Array.isArray(data.deleteCharacters) &&
              data.deleteCharacters.length > 0 && (
                <div className="rounded border border-rose-200 bg-rose-50/60 p-2 text-xs dark:border-rose-900/40 dark:bg-rose-950/20">
                  <div className="font-bold text-[11px] text-rose-700 dark:text-rose-400">
                    🗑️ 削除対象の登場人物 ({data.deleteCharacters.length}名)
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.deleteCharacters.map((name: string, i: number) => (
                      <span
                        key={i}
                        className="rounded bg-rose-100 px-1.5 py-0.5 font-medium text-[10px] text-rose-800 line-through dark:bg-rose-900/60 dark:text-rose-300"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            {Array.isArray(data.characters) && data.characters.length > 0 && (
              <div>
                <div className="font-bold text-[11px] text-indigo-700 dark:text-indigo-400">
                  👤 登場人物 ({data.characters.length}名)
                </div>
                <div className="mt-1 space-y-1 border-indigo-200 border-l-2 pl-1.5 dark:border-indigo-800">
                  {data.characters.map((c, i: number) => (
                    <div key={i} className="text-[11px]">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {c.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {" "}
                        ({c.category || "未分類"})
                      </span>
                      {c.description && (
                        <p className="line-clamp-1 text-[10px] text-slate-600 dark:text-slate-400">
                          {c.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(data.settings) && data.settings.length > 0 && (
              <div>
                <div className="font-bold text-[11px] text-teal-700 dark:text-teal-400">
                  🌍 世界観・設定 ({data.settings.length}件)
                </div>
                <div className="mt-1 space-y-1 border-teal-200 border-l-2 pl-1.5 dark:border-teal-800">
                  {data.settings.map((s, i: number) => (
                    <div key={i} className="text-[11px]">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {s.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {" "}
                        ({s.category})
                      </span>
                      {s.description && (
                        <p className="line-clamp-1 text-[10px] text-slate-600 dark:text-slate-400">
                          {s.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(data.foreshadowings) &&
              data.foreshadowings.length > 0 && (
                <div>
                  <div className="font-bold text-[11px] text-amber-700 dark:text-amber-400">
                    🔍 伏線 ({data.foreshadowings.length}件)
                  </div>
                </div>
              )}
            {Array.isArray(data.timelines) && data.timelines.length > 0 && (
              <div>
                <div className="font-bold text-[11px] text-blue-700 dark:text-blue-400">
                  ⏳ 年表イベント ({data.timelines.length}件)
                </div>
                <div className="mt-1 space-y-1 border-blue-200 border-l-2 pl-1.5 dark:border-blue-800">
                  {data.timelines.map((t, i: number) => (
                    <div key={i} className="text-[11px]">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {t.event}
                      </span>
                      {t.timestamp && (
                        <span className="text-[10px] text-slate-500">
                          {" "}
                          ({t.timestamp})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {proposalType === "character" && (
          <div className="space-y-1">
            {data.oldCharacterName && (
              <div className="rounded border border-rose-200 bg-rose-50/80 px-2 py-1 text-[11px] text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                🗑️ 削除対象の旧人物:{" "}
                <span className="font-bold line-through">
                  {data.oldCharacterName}
                </span>{" "}
                （反映時に自動削除されます）
              </div>
            )}
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {data.name}{" "}
              <span className="font-normal text-[11px] text-slate-500">
                ({data.category})
              </span>
            </div>
            {Array.isArray(data.traits) && data.traits.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {data.traits.map((t: string, i: number) => (
                  <span
                    key={i}
                    className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-400">
              {data.description}
            </p>
          </div>
        )}

        {proposalType === "setting" && (
          <div className="space-y-1">
            {data.oldSettingName && (
              <div className="rounded border border-rose-200 bg-rose-50/80 px-2 py-1 text-[11px] text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                🗑️ 削除対象の旧設定:{" "}
                <span className="font-bold line-through">
                  {data.oldSettingName}
                </span>{" "}
                （反映時に自動削除されます）
              </div>
            )}
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {data.name}{" "}
              <span className="font-normal text-[11px] text-slate-500">
                ({data.category})
              </span>
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-400">
              {data.description}
            </p>
          </div>
        )}

        {proposalType === "delete_setting" && (
          <div className="space-y-1">
            <div className="rounded border border-rose-200 bg-rose-50/80 p-2 text-rose-800 text-xs dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
              <div className="font-bold">
                🗑️ 削除する設定: <span className="underline">{data.name}</span>
              </div>
              {data.reason && (
                <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  理由: {data.reason}
                </div>
              )}
              <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-400">
                ※
                反映すると小説データおよび設定マークダウンから完全に削除されます
              </div>
            </div>
          </div>
        )}

        {proposalType === "delete_character" && (
          <div className="space-y-1">
            <div className="rounded border border-rose-200 bg-rose-50/80 p-2 text-rose-800 text-xs dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
              <div className="font-bold">
                🗑️ 削除する人物: <span className="underline">{data.name}</span>
              </div>
              {data.reason && (
                <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  理由: {data.reason}
                </div>
              )}
              <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-400">
                ※
                反映すると小説データおよび登場人物マークダウンから完全に削除されます
              </div>
            </div>
          </div>
        )}

        {proposalType === "foreshadowing" && (
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {data.title}{" "}
              <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                {data.status || "未回収"}
              </span>
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-400">
              {data.description}
            </p>
          </div>
        )}

        {proposalType === "timeline" && (
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {data.event}
            </div>
            {data.timestamp && (
              <div className="text-[11px] text-slate-500">
                時期: {data.timestamp}
              </div>
            )}
          </div>
        )}

        {proposalType === "plot" && (
          <div className="space-y-1">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {data.chapterTitle || data.title}
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-400">
              {data.summary}
            </p>
          </div>
        )}

        {proposalType === "story_outline" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                <span>📝 {safeSectionName}</span>
                {data.mode && data.mode !== "replace" && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.2 font-medium text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {data.mode === "append"
                      ? "追記"
                      : data.mode === "prepend"
                        ? "先頭挿入"
                        : "全体置換"}
                  </span>
                )}
              </div>
              {data.reason && (
                <span
                  className="max-w-40 truncate text-[10px] text-slate-500"
                  title={data.reason}
                >
                  {data.reason}
                </span>
              )}
            </div>
            {data.content?.trim() ? (
              <div className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded border border-slate-100 bg-slate-50/90 p-2 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                {data.content}
              </div>
            ) : (
              <div className="rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                ⚠️
                反映する本文が空です。AIに「具体的な構想本文も含めて再提案して」とお伝えください。
              </div>
            )}
          </div>
        )}
        {!targetNovelId && (
          <div className="rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            ⚠️
            反映先の小説が選択されていません。チャット上部の「対象」から小説を選択してください。
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {isApplied ? (
          <div className="flex items-center gap-1.5 font-medium text-emerald-800 text-xs dark:text-emerald-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            <span>✔ 小説データに反映完了: {cleanSummary}</span>
          </div>
        ) : isDismissed ? (
          <div className="text-slate-400 text-xs">
            ✕ 提案をスキップしました（{cleanSummary}）
          </div>
        ) : (
          <>
            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {cleanSummary}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {canShowDiff && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleOpenDiff}
                  disabled={isApplying || diffLoading}
                  isLoading={diffLoading}
                >
                  🔍 差分を確認
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setStatus("dismissed")}
                disabled={isApplying || diffLoading}
              >
                破棄
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={handleApply}
                disabled={
                  isApplying ||
                  diffLoading ||
                  !targetNovelId ||
                  (proposalType === "story_outline" && !data.content?.trim())
                }
              >
                {isApplying ? "反映中..." : "✔ 小説に反映する"}
              </Button>
            </div>
          </>
        )}
      </div>

      {diffData && (
        <ProposalDiffModal
          isOpen={diffModalOpen}
          onClose={() => setDiffModalOpen(false)}
          title={diffData.title}
          proposalSummary={cleanSummary}
          originalMarkdown={diffData.originalMarkdown}
          updatedMarkdown={diffData.updatedMarkdown}
          diffItems={diffData.diffItems}
          onApply={handleApply}
          onOpenInEditor={handleOpenInEditor}
          isApplying={isApplying}
        />
      )}
    </div>
  );
}
