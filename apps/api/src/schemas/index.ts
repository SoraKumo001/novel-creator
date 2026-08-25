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
  name: z.string().min(1),
  description: z.string().optional(),
  traits: z.array(z.string()).optional(),
  relationships: z.unknown().optional(),
});

export const updateCharacterSchema = z.object({
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
