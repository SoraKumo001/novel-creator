import { z } from "zod";

export const createNovelSchema = z.object({
  description: z.string().optional(),
  storyOutline: z.string().optional(),
  styleGuide: z.string().optional(),
  title: z.string().min(1),
});

export const updateNovelSchema = z.object({
  description: z.string().optional(),
  storyOutline: z.string().nullable().optional(),
  styleGuide: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
});

export const saveStoryOutlineSchema = z.object({
  markdown: z.string(),
});

export const editStoryOutlineSectionSchema = z.object({
  category: z.string(),
  content: z.string(),
  instruction: z.string().min(1),
  markdown: z.string(),
  modelConfigId: z.string().optional().nullable(),
  name: z.string(),
});

export const editStoryOutlineDocumentSchema = z.object({
  instruction: z.string().min(1),
  markdown: z.string(),
  modelConfigId: z.string().optional().nullable(),
});

export const generatePlotFromOutlineSchema = z.object({
  modelConfigId: z.string().optional().nullable(),
  storyOutline: z.string().min(1),
});

// ---- プロットマークダウン一括保存 ----
export const savePlotMarkdownSchema = z.object({
  markdown: z.string(),
});
