import { z } from 'zod';

// ---- novels ----
export const createNovelSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export const updateNovelSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

// ---- chapters ----
export const createChapterSchema = z.object({
  title: z.string().min(1),
  order: z.number().int().optional(),
  summary: z.string().optional(),
});

export const updateChapterSchema = z.object({
  title: z.string().min(1).optional(),
  order: z.number().int().optional(),
  summary: z.string().optional(),
});

// ---- sections ----
export const createSectionSchema = z.object({
  title: z.string().optional(),
  order: z.number().int().optional(),
  summary: z.string().optional(),
});

export const updateSectionSchema = z.object({
  title: z.string().optional(),
  order: z.number().int().optional(),
  summary: z.string().optional(),
});

// ---- contents ----
export const updateContentSchema = z.object({
  body: z.string(),
});

// ---- characters ----
export const createCharacterSchema = z.object({
  category: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  traits: z.array(z.string()).optional(),
  relationships: z.unknown().optional(),
});

export const updateCharacterSchema = z.object({
  category: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  traits: z.array(z.string()).optional(),
  relationships: z.unknown().optional(),
});

// ---- settings ----
export const createSettingSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  metadata: z.unknown().optional(),
});

export const updateSettingSchema = z.object({
  category: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  metadata: z.unknown().optional(),
});

// ---- timelines ----
export const createTimelineSchema = z.object({
  event: z.string().min(1),
  order: z.number().int().optional(),
  timestamp: z.string().optional(),
  sectionId: z.string().optional(),
});

// ---- foreshadowings ----
export const createForeshadowingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['unresolved', 'resolved', 'abandoned']).optional(),
  placedSectionId: z.string().uuid().optional().nullable(),
  resolvedSectionId: z.string().uuid().optional().nullable(),
});

export const updateForeshadowingSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['unresolved', 'resolved', 'abandoned']).optional(),
  placedSectionId: z.string().uuid().optional().nullable(),
  resolvedSectionId: z.string().uuid().optional().nullable(),
});

// ---- LLM 編集 ----
export const editInstructionSchema = z.object({
  instruction: z.string().min(1),
});

// ---- LLM指示履歴 ----
export const createLlmInstructionSchema = z.object({
  entityType: z.string().min(1),
  instruction: z.string().min(1),
});

// ---- 設定ドラフト生成 ----
export const settingDraftSchema = z.object({
  instruction: z.string().min(1),
  currentDraft: z
    .object({
      category: z.string(),
      name: z.string(),
      description: z.string().optional(),
    })
    .optional(),
});

// ---- 設定マークダウン一括保存 ----
export const saveSettingsMarkdownSchema = z.object({
  markdown: z.string().min(1),
});

// ---- 設定セクションLLM編集 ----
export const editSettingSectionSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  instruction: z.string().min(1),
});

// ---- 人物マークダウン一括保存 ----
export const saveCharactersMarkdownSchema = z.object({
  markdown: z.string().min(1),
});

// ---- 人物セクションLLM編集 ----
export const editCharacterSectionSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  traits: z.array(z.string()),
  relationships: z.string(),
  instruction: z.string().min(1),
});

// ---- 設定マークダウン全体LLM編集 ----
export const editSettingDocumentSchema = z.object({
  markdown: z.string().min(1),
  instruction: z.string().min(1),
});

// ---- 人物マークダウン全体LLM編集 ----
export const editCharacterDocumentSchema = z.object({
  markdown: z.string().min(1),
  instruction: z.string().min(1),
});

// ---- パラメータ ----
export const idParamSchema = z.object({
  id: z.uuid(),
});

export const novelIdParamSchema = z.object({
  novelId: z.uuid(),
});

export const chapterIdParamSchema = z.object({
  chapterId: z.uuid(),
});

export const sectionIdParamSchema = z.object({
  sectionId: z.uuid(),
});

// ---- チャット ----
export const createChatSessionSchema = z.object({
  novelId: z.string().uuid().optional(),
  title: z.string().optional(),
});

export const updateChatSessionSchema = z.object({
  title: z.string().min(1),
});

export const chatSessionQuerySchema = z.object({
  novelId: z.string().uuid().optional(),
});

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  novelId: z.string().uuid().optional(),
  messages: z.array(chatMessageSchema).min(1),
});

export const extractChatEntitiesSchema = z.object({
  text: z.string().min(1),
});

// ---- 履歴 ----
export const listHistoriesQuerySchema = z.object({
  novelId: z.string().uuid(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
