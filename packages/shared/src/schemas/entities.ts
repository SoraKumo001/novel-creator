// エンティティの wire 形式（HTTP 経由の JSON）を定義する単一情報源。日付は ISO 文字列。relationships/metadata は多形（文字列/オブジェクト）のため unknown のまま。
import { z } from "zod";
import { foreshadowingStatuses } from "../constants.js";

export type { ForeshadowingStatusValue } from "../constants.js";
export { foreshadowingStatuses };
export const foreshadowingStatusSchema = z.enum(foreshadowingStatuses);
export type ForeshadowingStatus = z.infer<typeof foreshadowingStatusSchema>;

const isoDateOrNull = z.string().nullable(); // wire 形式: ISO 文字列または null

export const novelSchema = z.object({
  createdAt: isoDateOrNull,
  description: z.string().nullable(),
  id: z.string(),
  storyOutline: z.string().nullable().optional(),
  styleGuide: z.string().nullable().optional(),
  title: z.string(),
  updatedAt: isoDateOrNull,
});
export type Novel = z.infer<typeof novelSchema>;

export const chapterSchema = z.object({
  createdAt: isoDateOrNull,
  id: z.string(),
  novelId: z.string(),
  order: z.number(),
  summary: z.string().nullable(),
  title: z.string(),
  updatedAt: isoDateOrNull,
});
export type Chapter = z.infer<typeof chapterSchema>;

export const sectionSchema = z.object({
  chapterId: z.string(),
  createdAt: isoDateOrNull,
  id: z.string(),
  order: z.number(),
  summary: z.string().nullable(),
  title: z.string().nullable(),
  updatedAt: isoDateOrNull,
});
export type Section = z.infer<typeof sectionSchema>;

export const contentSchema = z.object({
  body: z.string(),
  createdAt: isoDateOrNull,
  id: z.string(),
  sectionId: z.string(),
  updatedAt: isoDateOrNull,
  wordCount: z.number().nullable(),
});
export type Content = z.infer<typeof contentSchema>;

export const characterSchema = z.object({
  category: z.string(),
  createdAt: isoDateOrNull,
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  novelId: z.string(),
  relationships: z.unknown(),
  traits: z.array(z.string()).nullable(),
  updatedAt: isoDateOrNull,
});
export type Character = z.infer<typeof characterSchema>;

export const settingSchema = z.object({
  category: z.string(),
  createdAt: isoDateOrNull,
  description: z.string().nullable(),
  id: z.string(),
  metadata: z.unknown(),
  name: z.string(),
  novelId: z.string(),
  updatedAt: isoDateOrNull,
});
export type Setting = z.infer<typeof settingSchema>;

export const timelineSchema = z.object({
  createdAt: isoDateOrNull,
  event: z.string(),
  id: z.string(),
  novelId: z.string(),
  order: z.number(),
  sectionId: z.string().nullable(),
  timestamp: z.string().nullable(),
});
export type Timeline = z.infer<typeof timelineSchema>;

export const foreshadowingSchema = z.object({
  category: z.string().default("未分類"),
  createdAt: isoDateOrNull,
  description: z.string().nullable(),
  id: z.string(),
  novelId: z.string(),
  placedSectionId: z.string().nullable(),
  resolvedSectionId: z.string().nullable(),
  status: foreshadowingStatusSchema,
  title: z.string(),
  updatedAt: isoDateOrNull,
});
export type Foreshadowing = z.infer<typeof foreshadowingSchema>;

export const llmInstructionSchema = z.object({
  createdAt: isoDateOrNull,
  entityType: z.string(),
  id: z.string(),
  instruction: z.string(),
  novelId: z.string(),
});
export type LlmInstruction = z.infer<typeof llmInstructionSchema>;

export const chatSessionSchema = z.object({
  createdAt: isoDateOrNull,
  id: z.string(),
  novelId: z.string().nullable(),
  title: z.string(),
  updatedAt: isoDateOrNull,
});
export type ChatSession = z.infer<typeof chatSessionSchema>;

export const chatMessageSchema = z.object({
  content: z.string(),
  createdAt: isoDateOrNull,
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  sessionId: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
/** web 側の型名（ChatMessageItem）に合わせたエイリアス */
export type ChatMessageItem = ChatMessage;

export const customPromptSchema = z.object({
  category: z.enum(["inline", "generation", "chat", "general"]),
  createdAt: isoDateOrNull,
  description: z.string().nullable(),
  icon: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  novelId: z.string().nullable(),
  order: z.number(),
  systemPrompt: z.string().nullable(),
  updatedAt: isoDateOrNull,
  userPrompt: z.string(),
});
export type CustomPrompt = z.infer<typeof customPromptSchema>;

// ---- チャット提案・抽出 DTO（単一情報源） ----
// web の ChatProposalCard（proposalTypes.ts）および lib/types.ts の抽出型と重複していた
// エンティティ由来 DTO の正規定義。web 側はここからの再エクスポートに寄せる。

export const storyOutlineModeSchema = z.enum([
  "append",
  "full_document",
  "prepend",
  "replace",
]);
export type StoryOutlineMode = z.infer<typeof storyOutlineModeSchema>;

/** 一括登録（bulk）の登場人物アイテム。LLM 出力の title 表記ゆれを許容する防御的形状。 */
export const bulkCharacterItemSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  traits: z.array(z.string()).optional(),
});
export type BulkCharacterItem = z.infer<typeof bulkCharacterItemSchema>;

/** 一括登録（bulk）の世界観・設定アイテム。 */
export const bulkSettingItemSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
});
export type BulkSettingItem = z.infer<typeof bulkSettingItemSchema>;

/** 一括登録（bulk）の伏線アイテム（title が無く name / description のみのケースを許容）。 */
export const bulkForeshadowingItemSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional(),
  name: z.string().optional(),
  status: foreshadowingStatusSchema.optional(),
  title: z.string().optional(),
});
export type BulkForeshadowingItem = z.infer<typeof bulkForeshadowingItemSchema>;

/** 一括登録（bulk）の年表イベントアイテム。 */
export const bulkTimelineItemSchema = z.object({
  event: z.string().optional(),
  timestamp: z.string().nullable().optional(),
  title: z.string().optional(),
});
export type BulkTimelineItem = z.infer<typeof bulkTimelineItemSchema>;

/** チャット抽出の登場人物アイテム（必須フィールドの厳密形状）。 */
export const extractedCharacterItemSchema = z.object({
  category: z.string(),
  description: z.string(),
  name: z.string(),
  traits: z.array(z.string()),
});
export type ExtractedCharacterItem = z.infer<
  typeof extractedCharacterItemSchema
>;

/** チャット抽出の伏線アイテム。 */
export const extractedChatForeshadowingItemSchema = z.object({
  description: z.string(),
  status: foreshadowingStatusSchema,
  title: z.string(),
});
export type ExtractedChatForeshadowingItem = z.infer<
  typeof extractedChatForeshadowingItemSchema
>;

/** チャット抽出の年表イベントアイテム。 */
export const extractedChatTimelineItemSchema = z.object({
  event: z.string(),
  timestamp: z.string().nullable().optional(),
});
export type ExtractedChatTimelineItem = z.infer<
  typeof extractedChatTimelineItemSchema
>;

/** チャット抽出のプロットアイテム。 */
export const extractedChatPlotItemSchema = z.object({
  summary: z.string(),
  title: z.string(),
});
export type ExtractedChatPlotItem = z.infer<typeof extractedChatPlotItemSchema>;

/** 設定の抽出アイテム（id 付きの永続化前 DTO）。 */
export const extractedSettingItemSchema = z.object({
  category: z.string(),
  description: z.string().nullable().optional(),
  id: z.string().optional(),
  name: z.string(),
});
export type ExtractedSettingItem = z.infer<typeof extractedSettingItemSchema>;

/** 年表の抽出アイテム（id・order 付きの永続化前 DTO）。 */
export const extractedTimelineItemSchema = z.object({
  event: z.string(),
  id: z.string().optional(),
  order: z.number(),
  timestamp: z.string().nullable().optional(),
});
export type ExtractedTimelineItem = z.infer<typeof extractedTimelineItemSchema>;
