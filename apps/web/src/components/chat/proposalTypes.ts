/** ストーリー構想の更新モード */
export type StoryOutlineMode =
  | "append"
  | "full_document"
  | "prepend"
  | "replace";

/** 伏線のステータス */
export type ForeshadowingStatus = "abandoned" | "resolved" | "unresolved";

/** 一括登録（bulk）の登場人物アイテム。LLM ツール出力のため title 表記の揺れを許容する */
export interface BulkCharacterItem {
  category?: string;
  description?: string;
  name?: string;
  title?: string;
  traits?: string[];
}

/** 一括登録（bulk）の世界観・設定アイテム */
export interface BulkSettingItem {
  category?: string;
  description?: string;
  name?: string;
  title?: string;
}

/** 一括登録（bulk）の伏線アイテム（title が無く name / description のみのケースを許容） */
export interface BulkForeshadowingItem {
  category?: string;
  description?: string;
  name?: string;
  status?: ForeshadowingStatus;
  title?: string;
}

/** 一括登録（bulk）の年表イベントアイテム */
export interface BulkTimelineItem {
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
export interface ProposalDataBase {
  /** ストーリー構想の更新モード */
  mode?: StoryOutlineMode;
  /** 登録・削除・更新の理由（あれば） */
  reason?: string | null;
  /** ストーリー構想（story_outline）の対象セクション名 */
  sectionName?: string;
}

export interface BulkProposalData extends ProposalDataBase {
  characters?: BulkCharacterItem[];
  deleteCharacters?: string[];
  deleteSettings?: string[];
  foreshadowings?: BulkForeshadowingItem[];
  settings?: BulkSettingItem[];
  timelines?: BulkTimelineItem[];
}

export interface CharacterProposalData extends ProposalDataBase {
  category?: string;
  description?: string;
  name: string;
  oldCharacterName?: string | null;
  traits?: string[];
}

export interface SettingProposalData extends ProposalDataBase {
  category?: string;
  description?: string;
  name: string;
  oldSettingName?: string | null;
}

export interface DeleteProposalData extends ProposalDataBase {
  name: string;
}

export interface ForeshadowingProposalData extends ProposalDataBase {
  category?: string;
  description?: string;
  name?: string;
  status?: ForeshadowingStatus;
  title: string;
}

export interface TimelineProposalData extends ProposalDataBase {
  event: string;
  order?: number | null;
  timestamp?: string | null;
}

export interface PlotProposalData extends ProposalDataBase {
  chapterTitle: string;
  summary: string;
  /** LLM 出力の表記ゆれ（title）も許容する防御的フィールド */
  title: string;
}

export interface StoryOutlineProposalData extends ProposalDataBase {
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
export interface NormalizedBulkProposal {
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
export function normalizeProposal(
  data: BulkProposalData
): NormalizedBulkProposal {
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
export type NovelRouteTabId =
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
export function toRouteTab(tab: string): NovelRouteTabId {
  return tab as NovelRouteTabId;
}

/** 差分モーダルへ渡す単一タブ分のデータ */
export interface ProposalDiffData {
  diffItems?: import("./ProposalDiffModal.js").DiffTabItem[];
  entityType: string;
  originalMarkdown: string;
  targetTab: string;
  title: string;
  updatedMarkdown: string;
}

/** 提案カードが差分プレビューを表示できるか（純関数） */
export function canShowProposalDiff(proposal: ProposalPayload): boolean {
  const { proposalType, data } = proposal;
  if (proposalType !== "bulk") {
    return (
      proposalType === "story_outline" ||
      proposalType === "character" ||
      proposalType === "setting" ||
      proposalType === "delete_setting" ||
      proposalType === "delete_character" ||
      proposalType === "foreshadowing" ||
      proposalType === "timeline" ||
      proposalType === "plot"
    );
  }
  const d = data;
  return (
    (Array.isArray(d.characters) && d.characters.length > 0) ||
    (Array.isArray(d.settings) && d.settings.length > 0) ||
    (Array.isArray(d.foreshadowings) && d.foreshadowings.length > 0) ||
    (Array.isArray(d.timelines) && d.timelines.length > 0) ||
    (Array.isArray(d.deleteSettings) && d.deleteSettings.length > 0) ||
    (Array.isArray(d.deleteCharacters) && d.deleteCharacters.length > 0)
  );
}

/** proposal + 選択中 novelId から反映対象 novelId を解決する（純関数） */
export function resolveTargetNovelId(
  proposal: ProposalPayload,
  selectedNovelId?: string | null
): string {
  const rawNovelId = proposal.novelId;
  if (
    typeof rawNovelId === "string" &&
    rawNovelId.trim() &&
    rawNovelId !== "undefined" &&
    rawNovelId !== "null"
  ) {
    return rawNovelId.trim();
  }
  return selectedNovelId?.trim() || "";
}

/** story_outline 用の安全なセクション名を解決する（純関数） */
export function resolveSafeSectionName(proposal: ProposalPayload): string {
  const rawSectionName = proposal.data.sectionName;
  if (
    typeof rawSectionName === "string" &&
    rawSectionName.trim() &&
    rawSectionName !== "undefined"
  ) {
    return rawSectionName.trim();
  }
  return proposal.data.mode === "full_document"
    ? "ドキュメント全体"
    : "全体あらすじ";
}

/** カード下部に表示するサマリー文を解決する（純関数） */
export function resolveCleanSummary(
  proposal: ProposalPayload,
  safeSectionName: string
): string {
  const { proposalType, data, summary } = proposal;
  if (summary && !summary.includes("undefined")) {
    return summary;
  }
  if (proposalType === "story_outline") {
    return `ストーリー構想「${safeSectionName}」の更新提案${data.reason ? `（${data.reason}）` : ""}`;
  }
  return summary || "設定登録提案";
}
