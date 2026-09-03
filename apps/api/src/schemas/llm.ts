import { llmProviders } from "@novel-creator/shared";
import { z } from "zod";

// ---- LLM 設定 ----
export const createLlmConfigSchema = z.object({
  apiKey: z.string().optional().nullable(),
  baseUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  modelId: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(llmProviders),
});

export const updateLlmConfigSchema = z.object({
  apiKey: z.string().optional().nullable(),
  baseUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  modelId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  provider: z.enum(llmProviders).optional(),
});

export const testLlmConfigSchema = z.object({
  apiKey: z.string().optional().nullable(),
  baseUrl: z.string().optional().nullable(),
  modelId: z.string().min(1),
  provider: z.enum(llmProviders),
});

// ---- Embedding 設定 ----
export const createEmbeddingConfigSchema = z.object({
  apiKey: z.string().optional().nullable(),
  baseUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  dimensions: z.coerce.number().int().positive().default(1536),
  isDefault: z.boolean().optional(),
  modelId: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(llmProviders),
});

export const updateEmbeddingConfigSchema = z.object({
  apiKey: z.string().optional().nullable(),
  baseUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  dimensions: z.coerce.number().int().positive().optional(),
  isDefault: z.boolean().optional(),
  modelId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  provider: z.enum(llmProviders).optional(),
});

export const testEmbeddingConfigSchema = z.object({
  apiKey: z.string().optional().nullable(),
  baseUrl: z.string().optional().nullable(),
  dimensions: z.coerce.number().int().positive().optional(),
  modelId: z.string().min(1),
  provider: z.enum(llmProviders),
});

export const reindexBodySchema = z.object({
  embeddingConfigId: z.string().uuid().optional().nullable(),
});

/**
 * modelConfigId のみをボディで受け取る生成系エンドポイント共通のスキーマ。
 * （Hono RPC のクライアント型を変えないため、同一形状のスキーマはこれに統一する）
 */
export const modelConfigBodySchema = z.object({
  modelConfigId: z.string().uuid().optional().nullable(),
});

export const generateContentBodySchema = modelConfigBodySchema;

export const proofreadBodySchema = z.object({
  body: z.string().optional(),
  modelConfigId: z.string().uuid().optional().nullable(),
});

export const inlineAssistBodySchema = z.object({
  action: z.enum([
    "expand",
    "shorten",
    "emotional",
    "dialogue",
    "paraphrase",
    "custom",
    "template",
  ]),
  customInstruction: z.string().optional(),
  customPromptId: z.string().uuid().optional().nullable(),
  modelConfigId: z.string().uuid().optional().nullable(),
  selectedText: z.string().min(1),
  surroundingText: z.string().optional(),
  variantCount: z.coerce.number().int().min(1).max(3).optional().default(1),
});

export const checkCharacterVoiceBodySchema = z.object({
  body: z.string().optional(),
  modelConfigId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional(),
});

export const analyzeSettingImpactBodySchema = z.object({
  afterValue: z.string(),
  beforeValue: z.string(),
  changeTarget: z.enum(["character", "setting"]),
  modelConfigId: z.string().uuid().optional().nullable(),
  targetName: z.string().min(1),
});

export const analyzeStoryArcBodySchema = modelConfigBodySchema;

export const multiPersonaReviewBodySchema = z.object({
  body: z.string().optional(),
  chapterId: z.string().uuid().optional(),
  modelConfigId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional(),
});

export const generateStyleGuideDraftBodySchema = modelConfigBodySchema;

// ---- LLM 編集 ----
export const editInstructionSchema = z.object({
  instruction: z.string().min(1),
});

// ---- LLM指示履歴 ----
export const createLlmInstructionSchema = z.object({
  entityType: z.string().min(1),
  instruction: z.string().min(1),
});
