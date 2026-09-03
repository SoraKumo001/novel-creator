import { z } from "zod";

export const createSettingSchema = z.object({
  category: z.string().min(1),
  description: z.string().optional(),
  metadata: z.unknown().optional(),
  name: z.string().min(1),
});

export const updateSettingSchema = z.object({
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  metadata: z.unknown().optional(),
  name: z.string().min(1).optional(),
});

// ---- 設定ドラフト生成 ----
export const settingDraftSchema = z.object({
  currentDraft: z
    .object({
      category: z.string(),
      description: z.string().optional(),
      name: z.string(),
    })
    .optional(),
  instruction: z.string().min(1),
});

// ---- 設定マークダウン一括保存 ----
export const saveSettingsMarkdownSchema = z.object({
  markdown: z.string().min(1),
});

// ---- 設定セクションLLM編集 ----
export const editSettingSectionSchema = z.object({
  category: z.string().min(1),
  description: z.string(),
  instruction: z.string().min(1),
  name: z.string().min(1),
});

// ---- 設定マークダウン全体LLM編集 ----
export const editSettingDocumentSchema = z.object({
  instruction: z.string().min(1),
  markdown: z.string().min(1),
});
