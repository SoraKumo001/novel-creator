import type { ToolSet } from "ai";
import { z } from "zod";
import type { ServiceContext } from "../types.js";
import { createNovelScope, createTool } from "./scopedTool.js";
import {
  foreshadowingStatusValue,
  novelIdParam,
  type ScopedToolDefinition,
} from "./toolSchemas.js";

/**
 * 創作相談チャット用の小説設定提案ツール群（Propose Tools）。
 * LLMは会話中に設定や伏線・プロットの作成・更新を提案するためにこれらのツールを呼び出す。
 * ツール実行時はDBを直接破壊・変更せず、フロントエンドで承認（Human-in-the-loop）するための
 * 構造化された提案ペイロードを返す。
 *
 * 各ツールは下部の proposeToolTable（zod schema + handler のテーブル）に定義し、
 * createProposeTools ではスコープ解決のみを付与して ToolSet を組み立てる。
 * 公開シグネチャ・ツール名・入出力形状・実行結果は従来通り。
 */

// ===== 入力スキーマ（テーブル化・単一定義） =====

export const proposeAddForeshadowingInputSchema = z.object({
  description: z.string().describe("伏線の詳細、真相、回収アイデア"),
  novelId: novelIdParam,
  status: foreshadowingStatusValue
    .optional()
    .default("unresolved")
    .describe("ステータス（通常は unresolved）"),
  title: z.string().describe("伏線のタイトル・概要"),
});
export type ProposeAddForeshadowingParams = z.output<
  typeof proposeAddForeshadowingInputSchema
>;

export const proposeAddTimelineEventInputSchema = z.object({
  event: z.string().describe("出来事・イベントの内容"),
  novelId: novelIdParam,
  timestamp: z
    .string()
    .optional()
    .describe(
      "作中時期や日時・順序を表す文字列（例: 帝都暦742年、物語開始直前など）"
    ),
});
export type ProposeAddTimelineEventParams = z.output<
  typeof proposeAddTimelineEventInputSchema
>;

export const proposeCreateCharacterInputSchema = z.object({
  category: z
    .string()
    .optional()
    .default("未分類")
    .describe("役割・身分（例: 主人公, ヒロイン, 敵役, 師匠, 騎士団長 など）"),
  description: z
    .string()
    .describe("外見、性格、背景、能力、動機などの詳細説明"),
  name: z.string().describe("キャラクター名"),
  novelId: novelIdParam,
  oldCharacterName: z
    .string()
    .optional()
    .describe(
      "置換・更新元の古い登場人物名。設定変更に伴い古い人物を削除したい場合に指定します。"
    ),
  traits: z
    .array(z.string())
    .optional()
    .default([])
    .describe('特徴・キーワードの配列（例: ["銀髪", "冷静沈着", "炎魔法"]）'),
});
export type ProposeCreateCharacterParams = z.output<
  typeof proposeCreateCharacterInputSchema
>;

export const proposeCreateSettingInputSchema = z.object({
  category: z
    .string()
    .describe(
      "カテゴリ（例: 世界観, 魔法・技術, 地理・場所, 組織・国家, 歴史・事件, アイテム）"
    ),
  description: z.string().describe("設定の詳細説明や作中ルール"),
  name: z.string().describe("設定の名称"),
  novelId: novelIdParam,
  oldSettingName: z
    .string()
    .optional()
    .describe(
      "置換・更新元の古い設定名。設定名変更や差し替えに伴い古い設定を削除したい場合に指定します。"
    ),
});
export type ProposeCreateSettingParams = z.output<
  typeof proposeCreateSettingInputSchema
>;

export const proposeDeleteSettingInputSchema = z.object({
  name: z.string().describe("削除する世界観・設定の名称"),
  novelId: novelIdParam,
  reason: z.string().optional().describe("この設定を削除する理由・背景の説明"),
});
export type ProposeDeleteSettingParams = z.output<
  typeof proposeDeleteSettingInputSchema
>;

export const proposeDeleteCharacterInputSchema = z.object({
  name: z.string().describe("削除する登場人物の名称"),
  novelId: novelIdParam,
  reason: z.string().optional().describe("この人物を削除する理由・背景の説明"),
});
export type ProposeDeleteCharacterParams = z.output<
  typeof proposeDeleteCharacterInputSchema
>;

export const proposeUpdatePlotInputSchema = z.object({
  chapterId: z
    .string()
    .optional()
    .describe(
      "更新対象の章ID（会話コンテキストに章一覧とIDが提示されている場合はその値をそのまま指定する。IDは絶対に創作・推測しないこと。ID不明の場合は省略し、代わりに oldTitle を指定すること）"
    ),
  chapterTitle: z.string().describe("章のタイトル（例: 第1章 旅立ち）"),
  novelId: novelIdParam,
  oldTitle: z
    .string()
    .optional()
    .describe(
      "更新元の古い章タイトル。既存章の改名・更新で chapterId が不明な場合に指定する（タイトルの「第N章」接頭辞の有無は問わない）"
    ),
  summary: z.string().describe("提案する章のあらすじ・プロット内容"),
});
export type ProposeUpdatePlotParams = z.output<
  typeof proposeUpdatePlotInputSchema
>;

export const proposeUpdateStoryOutlineInputSchema = z.object({
  content: z
    .string()
    .min(
      1,
      "反映する本文（content）は必須です。反映したい具体的なマークダウンテキストを必ず格納してください。"
    )
    .describe(
      "反映するマークダウン形式の本文（箇条書きや文章、またはドキュメント全体の完全なテキスト）。空にしてはいけません。"
    ),
  mode: z
    .enum(["replace", "append", "prepend", "full_document"])
    .optional()
    .default("replace")
    .describe(
      "反映モード（replace: 指定セクション全体を置換, append: 末尾に追記, prepend: 先頭に挿入, full_document: ドキュメント全体を一括置換）"
    ),
  novelId: novelIdParam,
  reason: z
    .string()
    .optional()
    .describe("この更新を提案する理由・変更ポイントの要約"),
  sectionName: z
    .string()
    .optional()
    .describe(
      '反映先セクション名または見出し名（例: "全体あらすじ", "結（結末・エンディング）", "起（序盤・導入）", "承（中盤・展開）", "転（転換点・クライマックス）", "今後の展開候補 & 分岐アイデア", "作品コンセプト & ログライン", "ドキュメント全体" など。省略時は自動判定）'
    ),
});
export type ProposeUpdateStoryOutlineParams = z.output<
  typeof proposeUpdateStoryOutlineInputSchema
>;

export const proposeBulkCreateInputSchema = z.object({
  characters: z
    .array(
      z.object({
        category: z.string().optional().default("未分類"),
        description: z.string().describe("外見、性格、背景などの説明"),
        name: z.string().describe("キャラクター名"),
        traits: z.array(z.string()).optional().default([]),
      })
    )
    .optional()
    .default([])
    .describe("提案する登場人物の配列"),
  deleteCharacters: z
    .array(z.string())
    .optional()
    .default([])
    .describe("一括処理で同時に削除する古い登場人物名の配列"),
  deleteSettings: z
    .array(z.string())
    .optional()
    .default([])
    .describe("一括処理で同時に削除する古い世界観・設定名の配列"),
  foreshadowings: z
    .array(
      z.object({
        description: z.string().describe("伏線の詳細"),
        status: foreshadowingStatusValue.optional().default("unresolved"),
        title: z.string().describe("伏線タイトル"),
      })
    )
    .optional()
    .default([])
    .describe("提案する伏線の配列"),
  novelId: novelIdParam,
  settings: z
    .array(
      z.object({
        category: z.string().describe("カテゴリ（世界観、地理等）"),
        description: z.string().describe("設定詳細"),
        name: z.string().describe("設定名"),
      })
    )
    .optional()
    .default([])
    .describe("提案する世界観・設定の配列"),
  summary: z
    .string()
    .optional()
    .describe("提案全体の簡単な要約（例: メインキャラ3名と世界観設定の追加）"),
  timelines: z
    .array(
      z.object({
        event: z.string().describe("出来事"),
        timestamp: z.string().optional().describe("時期・日時"),
      })
    )
    .optional()
    .default([])
    .describe("提案する年表イベントの配列"),
});
export type ProposeBulkCreateParams = z.output<
  typeof proposeBulkCreateInputSchema
>;

// ===== ハンドラ（テーブル化・純粋関数として単一定義） =====

export interface ProposalResultData {
  [key: string]: unknown;
}

export interface ProposalResult {
  data: ProposalResultData;
  novelId: string;
  proposalType: string;
  summary: string;
  type: "proposal";
}

function handleProposeAddForeshadowing(
  targetId: string,
  { title, description, status = "unresolved" }: ProposeAddForeshadowingParams
): ProposalResult {
  return {
    data: {
      description,
      status,
      title,
    },
    novelId: targetId,
    proposalType: "foreshadowing",
    summary: `伏線「${title}」の登録提案`,
    type: "proposal",
  };
}

function handleProposeAddTimelineEvent(
  targetId: string,
  { event, timestamp }: ProposeAddTimelineEventParams
): ProposalResult {
  return {
    data: {
      event,
      timestamp: timestamp || null,
    },
    novelId: targetId,
    proposalType: "timeline",
    summary: `年表イベント「${event}」の追加提案`,
    type: "proposal",
  };
}

function handleProposeCreateCharacter(
  targetId: string,
  {
    name,
    category = "未分類",
    description,
    traits = [],
    oldCharacterName,
  }: ProposeCreateCharacterParams
): ProposalResult {
  const hasReplace =
    typeof oldCharacterName === "string" && oldCharacterName.trim().length > 0;
  const replaceSummary = hasReplace
    ? `（旧「${oldCharacterName.trim()}」を削除して置換）`
    : "";

  return {
    data: {
      category,
      description,
      name,
      oldCharacterName: hasReplace ? oldCharacterName.trim() : null,
      traits,
    },
    novelId: targetId,
    proposalType: "character",
    summary: `登場人物「${name}」の設定登録提案${replaceSummary}`,
    type: "proposal",
  };
}

function handleProposeCreateSetting(
  targetId: string,
  { name, category, description, oldSettingName }: ProposeCreateSettingParams
): ProposalResult {
  const hasReplace =
    typeof oldSettingName === "string" && oldSettingName.trim().length > 0;
  const replaceSummary = hasReplace
    ? `（旧「${oldSettingName.trim()}」を削除して置換）`
    : "";

  return {
    data: {
      category,
      description,
      name,
      oldSettingName: hasReplace ? oldSettingName.trim() : null,
    },
    novelId: targetId,
    proposalType: "setting",
    summary: `世界観設定「${name}」(${category})の登録提案${replaceSummary}`,
    type: "proposal",
  };
}

function handleProposeDeleteSetting(
  targetId: string,
  { name, reason }: ProposeDeleteSettingParams
): ProposalResult {
  return {
    data: {
      name,
      reason: reason || null,
    },
    novelId: targetId,
    proposalType: "delete_setting",
    summary: `世界観設定「${name}」の削除提案${reason ? `（${reason}）` : ""}`,
    type: "proposal",
  };
}

function handleProposeDeleteCharacter(
  targetId: string,
  { name, reason }: ProposeDeleteCharacterParams
): ProposalResult {
  return {
    data: {
      name,
      reason: reason || null,
    },
    novelId: targetId,
    proposalType: "delete_character",
    summary: `登場人物「${name}」の削除提案${reason ? `（${reason}）` : ""}`,
    type: "proposal",
  };
}

function handleProposeUpdatePlot(
  targetId: string,
  { chapterTitle, summary, chapterId, oldTitle }: ProposeUpdatePlotParams
): ProposalResult {
  const resolvedChapterId =
    typeof chapterId === "string" && chapterId.trim().length > 0
      ? chapterId.trim()
      : null;
  const resolvedOldTitle =
    typeof oldTitle === "string" && oldTitle.trim().length > 0
      ? oldTitle.trim()
      : null;
  return {
    data: {
      chapterId: resolvedChapterId,
      chapterTitle,
      oldTitle: resolvedOldTitle,
      summary,
    },
    novelId: targetId,
    proposalType: "plot",
    summary: `章「${chapterTitle}」のプロット反映提案`,
    type: "proposal",
  };
}

function handleProposeUpdateStoryOutline(
  targetId: string,
  {
    sectionName,
    content,
    mode = "replace",
    reason,
  }: ProposeUpdateStoryOutlineParams
): ProposalResult {
  const resolvedSection =
    typeof sectionName === "string" &&
    sectionName.trim() &&
    sectionName !== "undefined"
      ? sectionName.trim()
      : mode === "full_document"
        ? "ドキュメント全体"
        : "全体あらすじ";

  return {
    data: {
      content,
      mode,
      reason: reason || null,
      sectionName: resolvedSection,
    },
    novelId: targetId,
    proposalType: "story_outline",
    summary: `ストーリー構想「${resolvedSection}」の更新提案${reason ? `（${reason}）` : ""}`,
    type: "proposal",
  };
}

function handleProposeBulkCreate(
  targetId: string,
  {
    characters = [],
    settings = [],
    foreshadowings = [],
    timelines = [],
    deleteSettings = [],
    deleteCharacters = [],
    summary,
  }: ProposeBulkCreateParams
): ProposalResult {
  const normalizedCharacters = characters.map((c) => ({
    category: c.category || "未分類",
    description: c.description,
    name: c.name,
    traits: c.traits || [],
  }));
  const normalizedSettings = settings.map((s) => ({
    category: s.category || "世界観",
    description: s.description,
    name: s.name,
  }));
  const normalizedForeshadowings = foreshadowings.map((f) => ({
    description: f.description || "",
    status: f.status || "unresolved",
    title: f.title,
  }));
  const normalizedTimelines = timelines.map((t) => ({
    event: t.event,
    timestamp: t.timestamp || null,
  }));

  const totalAddCount =
    normalizedCharacters.length +
    normalizedSettings.length +
    normalizedForeshadowings.length +
    normalizedTimelines.length;
  const totalDelCount = deleteSettings.length + deleteCharacters.length;

  const parts: string[] = [];
  if (normalizedCharacters.length > 0) {
    parts.push(`人物${normalizedCharacters.length}件`);
  }
  if (normalizedSettings.length > 0) {
    parts.push(`設定${normalizedSettings.length}件`);
  }
  if (normalizedForeshadowings.length > 0) {
    parts.push(`伏線${normalizedForeshadowings.length}件`);
  }
  if (normalizedTimelines.length > 0) {
    parts.push(`年表${normalizedTimelines.length}件`);
  }
  if (deleteSettings.length > 0) {
    parts.push(`旧設定削除${deleteSettings.length}件`);
  }
  if (deleteCharacters.length > 0) {
    parts.push(`旧人物削除${deleteCharacters.length}件`);
  }

  const defaultSummary =
    summary ||
    `設定の一括登録提案（合計${totalAddCount + totalDelCount}件: ${parts.join("、")}）`;

  return {
    data: {
      characters: normalizedCharacters,
      deleteCharacters: deleteCharacters.filter((n) => n.trim().length > 0),
      deleteSettings: deleteSettings.filter((n) => n.trim().length > 0),
      foreshadowings: normalizedForeshadowings,
      settings: normalizedSettings,
      timelines: normalizedTimelines,
    },
    novelId: targetId,
    proposalType: "bulk",
    summary: defaultSummary,
    type: "proposal",
  };
}

// ===== ツール定義テーブル（schema + handler の単一情報源） =====

const proposeToolTable = {
  proposeAddForeshadowing: {
    description:
      "新しい伏線の登録をユーザーに提案します。作中に散りばめる謎や回収計画が考案された場合に使用してください。",
    errorMessage: "伏線登録提案の生成に失敗しました。",
    handler: handleProposeAddForeshadowing,
    inputSchema: proposeAddForeshadowingInputSchema,
  } satisfies ScopedToolDefinition<
    typeof proposeAddForeshadowingInputSchema,
    ProposalResult
  >,
  proposeAddTimelineEvent: {
    description:
      "作中の時系列・年表への新しい出来事（イベント）の追加をユーザーに提案します。",
    errorMessage: "年表イベント追加提案の生成に失敗しました。",
    handler: handleProposeAddTimelineEvent,
    inputSchema: proposeAddTimelineEventInputSchema,
  } satisfies ScopedToolDefinition<
    typeof proposeAddTimelineEventInputSchema,
    ProposalResult
  >,
  proposeBulkCreate: {
    description:
      "複数の登場人物、世界観設定、伏線、年表イベントなどをまとめて一括でユーザーに登録提案します。会話の中で複数のキャラクターや設定が同時に考案された場合は、個別にツールを何度も呼ぶのではなく、必ずこの一括提案ツールを1回だけ呼び出してください。",
    errorMessage: "一括登録提案の生成に失敗しました。",
    handler: handleProposeBulkCreate,
    inputSchema: proposeBulkCreateInputSchema,
  } satisfies ScopedToolDefinition<
    typeof proposeBulkCreateInputSchema,
    ProposalResult
  >,
  proposeCreateCharacter: {
    description:
      "新しい登場人物（キャラクター）の登録、または既存の古い人物の削除を伴う設定更新・置換をユーザーに提案します。会話の中で新しい人物が考案されたり、既存人物の名前・設定の刷新が決まった場合に使用してください。",
    errorMessage: "キャラクター登録提案の生成に失敗しました。",
    handler: handleProposeCreateCharacter,
    inputSchema: proposeCreateCharacterInputSchema,
  } satisfies ScopedToolDefinition<
    typeof proposeCreateCharacterInputSchema,
    ProposalResult
  >,
  proposeCreateSetting: {
    description:
      "新しい世界観・設定（用語、地理、魔法体系、組織、アイテムなど）の登録、または既存の古い設定の削除を伴う更新・置換をユーザーに提案します。会話の中で新しい設定が考案されたり、既存設定の名称変更・全面差し替えが決まった場合に使用してください。",
    errorMessage: "設定登録提案の生成に失敗しました。",
    handler: handleProposeCreateSetting,
    inputSchema: proposeCreateSettingInputSchema,
  } satisfies ScopedToolDefinition<
    typeof proposeCreateSettingInputSchema,
    ProposalResult
  >,
  proposeDeleteCharacter: {
    description:
      "不要になった登場人物（キャラクター）の削除をユーザーに提案します。会話の中で廃止・退場が決まった人物がある場合に使用してください。",
    errorMessage: "キャラクター削除提案の生成に失敗しました。",
    handler: handleProposeDeleteCharacter,
    inputSchema: proposeDeleteCharacterInputSchema,
  } satisfies ScopedToolDefinition<
    typeof proposeDeleteCharacterInputSchema,
    ProposalResult
  >,
  proposeDeleteSetting: {
    description:
      "不要になった世界観・設定の削除をユーザーに提案します。会話の中で廃止・整理が決まった設定がある場合に使用してください。",
    errorMessage: "設定削除提案の生成に失敗しました。",
    handler: handleProposeDeleteSetting,
    inputSchema: proposeDeleteSettingInputSchema,
  } satisfies ScopedToolDefinition<
    typeof proposeDeleteSettingInputSchema,
    ProposalResult
  >,
  proposeUpdatePlot: {
    description:
      "章のプロット・あらすじの作成または更新をユーザーに提案します。既存の章を更新する場合は、会話コンテキストに提示された章IDを chapterId にそのまま指定してください（IDを推測・創作してはいけません）。chapterId が不明な場合は oldTitle に既存の章タイトルを指定してください。新規章の場合は chapterTitle と summary のみを指定します。",
    errorMessage: "プロット反映提案の生成に失敗しました。",
    handler: handleProposeUpdatePlot,
    inputSchema: proposeUpdatePlotInputSchema,
  } satisfies ScopedToolDefinition<
    typeof proposeUpdatePlotInputSchema,
    ProposalResult
  >,
  proposeUpdateStoryOutline: {
    description:
      "ストーリー構想（全体のあらすじ、起承転結、序盤・中盤・結末、今後の展開候補、構想メモなど）のマークダウンの追加・更新・ブラッシュアップをユーザーに提案します。反映したい具体的な文章・マークダウン本文を必ず content 引数に完全に含めて呼び出してください。全体を一括更新する場合は mode: 'full_document'、特定セクションを更新する場合はそのセクション名を指定します。",
    errorMessage: "ストーリー構想更新提案の生成に失敗しました。",
    handler: handleProposeUpdateStoryOutline,
    inputSchema: proposeUpdateStoryOutlineInputSchema,
  } satisfies ScopedToolDefinition<
    typeof proposeUpdateStoryOutlineInputSchema,
    ProposalResult
  >,
};

export type ProposeToolName = keyof typeof proposeToolTable;

export function createProposeTools(
  _ctx: ServiceContext,
  defaultNovelId?: string | null
): ToolSet {
  const novelScope = createNovelScope(defaultNovelId);

  return {
    proposeAddForeshadowing: createTool({
      ...proposeToolTable.proposeAddForeshadowing,
      scope: novelScope.fromParam,
    }),
    proposeAddTimelineEvent: createTool({
      ...proposeToolTable.proposeAddTimelineEvent,
      scope: novelScope.fromParam,
    }),
    proposeBulkCreate: createTool({
      ...proposeToolTable.proposeBulkCreate,
      scope: novelScope.fromParam,
    }),
    proposeCreateCharacter: createTool({
      ...proposeToolTable.proposeCreateCharacter,
      scope: novelScope.fromParam,
    }),
    proposeCreateSetting: createTool({
      ...proposeToolTable.proposeCreateSetting,
      scope: novelScope.fromParam,
    }),
    proposeDeleteCharacter: createTool({
      ...proposeToolTable.proposeDeleteCharacter,
      scope: novelScope.fromParam,
    }),
    proposeDeleteSetting: createTool({
      ...proposeToolTable.proposeDeleteSetting,
      scope: novelScope.fromParam,
    }),
    proposeUpdatePlot: createTool({
      ...proposeToolTable.proposeUpdatePlot,
      scope: novelScope.fromParam,
    }),
    proposeUpdateStoryOutline: createTool({
      ...proposeToolTable.proposeUpdateStoryOutline,
      scope: novelScope.fromParam,
    }),
  };
}
