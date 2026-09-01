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
