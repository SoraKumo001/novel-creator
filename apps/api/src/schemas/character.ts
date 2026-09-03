import { z } from "zod";

export const createCharacterSchema = z.object({
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  name: z.string().min(1),
  relationships: z.unknown().optional(),
  traits: z.array(z.string()).optional(),
});

export const updateCharacterSchema = z.object({
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  name: z.string().min(1).optional(),
  relationships: z.unknown().optional(),
  traits: z.array(z.string()).optional(),
});

// ---- 人物マークダウン一括保存 ----
export const saveCharactersMarkdownSchema = z.object({
  markdown: z.string(),
});

// ---- 人物セクションLLM編集 ----
export const editCharacterSectionSchema = z.object({
  category: z.string().min(1),
  description: z.string(),
  instruction: z.string().min(1),
  name: z.string().min(1),
  relationships: z.string(),
  traits: z.array(z.string()),
});

// ---- 人物マークダウン全体LLM編集 ----
export const editCharacterDocumentSchema = z.object({
  instruction: z.string().min(1),
  markdown: z.string().min(1),
});
