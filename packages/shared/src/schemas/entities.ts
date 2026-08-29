// エンティティの wire 形式（HTTP 経由の JSON）を定義する単一情報源。日付は ISO 文字列。relationships/metadata は多形（文字列/オブジェクト）のため unknown のまま。
import { z } from 'zod';
import { foreshadowingStatuses } from '../constants.js';

export { foreshadowingStatuses };
export type { ForeshadowingStatusValue } from '../constants.js';
export const foreshadowingStatusSchema = z.enum(foreshadowingStatuses);
export type ForeshadowingStatus = z.infer<typeof foreshadowingStatusSchema>;

const isoDateOrNull = z.string().nullable(); // wire 形式: ISO 文字列または null

export const novelSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  createdAt: isoDateOrNull,
  updatedAt: isoDateOrNull,
});
export type Novel = z.infer<typeof novelSchema>;

export const chapterSchema = z.object({
  id: z.string(),
  novelId: z.string(),
  title: z.string(),
  order: z.number(),
  summary: z.string().nullable(),
  createdAt: isoDateOrNull,
  updatedAt: isoDateOrNull,
});
export type Chapter = z.infer<typeof chapterSchema>;

export const sectionSchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  title: z.string().nullable(),
  order: z.number(),
  summary: z.string().nullable(),
  createdAt: isoDateOrNull,
  updatedAt: isoDateOrNull,
});
export type Section = z.infer<typeof sectionSchema>;

export const contentSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  body: z.string(),
  wordCount: z.number().nullable(),
  createdAt: isoDateOrNull,
  updatedAt: isoDateOrNull,
});
export type Content = z.infer<typeof contentSchema>;

export const characterSchema = z.object({
  id: z.string(),
  novelId: z.string(),
  category: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  traits: z.array(z.string()).nullable(),
  relationships: z.unknown(),
  createdAt: isoDateOrNull,
  updatedAt: isoDateOrNull,
});
export type Character = z.infer<typeof characterSchema>;

export const settingSchema = z.object({
  id: z.string(),
  novelId: z.string(),
  category: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  metadata: z.unknown(),
  createdAt: isoDateOrNull,
  updatedAt: isoDateOrNull,
});
export type Setting = z.infer<typeof settingSchema>;

export const timelineSchema = z.object({
  id: z.string(),
  novelId: z.string(),
  sectionId: z.string().nullable(),
  event: z.string(),
  order: z.number(),
  timestamp: z.string().nullable(),
  createdAt: isoDateOrNull,
});
export type Timeline = z.infer<typeof timelineSchema>;

export const foreshadowingSchema = z.object({
  id: z.string(),
  novelId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: foreshadowingStatusSchema,
  placedSectionId: z.string().nullable(),
  resolvedSectionId: z.string().nullable(),
  createdAt: isoDateOrNull,
  updatedAt: isoDateOrNull,
});
export type Foreshadowing = z.infer<typeof foreshadowingSchema>;

export const llmInstructionSchema = z.object({
  id: z.string(),
  novelId: z.string(),
  entityType: z.string(),
  instruction: z.string(),
  createdAt: isoDateOrNull,
});
export type LlmInstruction = z.infer<typeof llmInstructionSchema>;

export const chatSessionSchema = z.object({
  id: z.string(),
  novelId: z.string().nullable(),
  title: z.string(),
  createdAt: isoDateOrNull,
  updatedAt: isoDateOrNull,
});
export type ChatSession = z.infer<typeof chatSessionSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: isoDateOrNull,
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;
/** web 側の型名（ChatMessageItem）に合わせたエイリアス */
export type ChatMessageItem = ChatMessage;
