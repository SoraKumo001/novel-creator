import type {
  NewChapter,
  NewCharacter,
  NewChatMessage,
  NewChatSession,
  NewContent,
  NewLlmInstruction,
  NewNovel,
  NewSection,
  NewSetting,
  NewTimeline,
} from "@novel-creator/db";
import { llmProviders } from "@novel-creator/shared";
import { foreshadowingStatusSchema } from "@novel-creator/shared/schemas";
import { z } from "zod";

// ---- novels ----
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

// ---- chapters ----
export const createChapterSchema = z.object({
  order: z.number().int().optional(),
  summary: z.string().optional(),
  title: z.string().min(1),
});

export const updateChapterSchema = z.object({
  order: z.number().int().optional(),
  summary: z.string().optional(),
  title: z.string().min(1).optional(),
});

// ---- sections ----
export const createSectionSchema = z.object({
  order: z.number().int().optional(),
  summary: z.string().optional(),
  title: z.string().optional(),
});

export const updateSectionSchema = z.object({
  order: z.number().int().optional(),
  summary: z.string().optional(),
  title: z.string().optional(),
});

// ---- contents ----
export const updateContentSchema = z.object({
  body: z.string(),
});

// ---- characters ----
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

// ---- settings ----
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

// ---- timelines ----
export const createTimelineSchema = z.object({
  event: z.string().min(1),
  order: z.number().int().optional(),
  sectionId: z.string().optional(),
  timestamp: z.string().optional(),
});

export const updateTimelineSchema = z.object({
  event: z.string().min(1).optional(),
  order: z.number().int().optional(),
  sectionId: z.string().optional().nullable(),
  timestamp: z.string().optional().nullable(),
});

// ---- foreshadowings ----
export const createForeshadowingSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional(),
  placedSectionId: z.string().uuid().optional().nullable(),
  resolvedSectionId: z.string().uuid().optional().nullable(),
  status: foreshadowingStatusSchema.optional(),
  title: z.string().min(1),
});

export const updateForeshadowingSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional().nullable(),
  placedSectionId: z.string().uuid().optional().nullable(),
  resolvedSectionId: z.string().uuid().optional().nullable(),
  status: foreshadowingStatusSchema.optional(),
  title: z.string().min(1).optional(),
});

export const foreshadowingDraftSchema = z.object({
  currentDraft: z
    .object({
      category: z.string().optional(),
      description: z.string().optional(),
      status: foreshadowingStatusSchema.optional(),
      title: z.string(),
    })
    .optional(),
  instruction: z.string().min(1),
});

export const saveForeshadowingsMarkdownSchema = z.object({
  markdown: z.string().min(1),
});

export const editForeshadowingSectionSchema = z.object({
  category: z.string().min(1),
  description: z.string(),
  instruction: z.string().min(1),
  status: foreshadowingStatusSchema.optional(),
  title: z.string().min(1),
});

export const editForeshadowingDocumentSchema = z.object({
  instruction: z.string().min(1),
  markdown: z.string().min(1),
});

// ---- バックアップ ----
// バックアップの構造を緩く検証する。行レベルの厳密な検証は importNovel が行うため、
// ここでは rdb.novel の存在と各テーブルの配列形状のみを保証する。
// ワイヤ上の行は任意の JSON オブジェクトのため、ドメイン型（New* 行）へは
// 型ガード（z.custom）で復元する。検証の緩さ（wire format）は従来どおり。
const isRecordObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const backupBodySchema = z.object({
  meta: z.object({
    exportedAt: z.string().optional(),
    novelId: z.string(),
    novelTitle: z.string().optional(),
    version: z.number(),
  }),
  rdb: z.object({
    chapters: z.custom<NewChapter[]>(Array.isArray).optional(),
    characters: z.custom<NewCharacter[]>(Array.isArray).optional(),
    chatMessages: z.custom<NewChatMessage[]>(Array.isArray).optional(),
    chatSessions: z.custom<NewChatSession[]>(Array.isArray).optional(),
    contents: z.custom<NewContent[]>(Array.isArray).optional(),
    llmInstructions: z.custom<NewLlmInstruction[]>(Array.isArray).optional(),
    novel: z.custom<NewNovel>(isRecordObject),
    sections: z.custom<NewSection[]>(Array.isArray).optional(),
    settings: z.custom<NewSetting[]>(Array.isArray).optional(),
    timelines: z.custom<NewTimeline[]>(Array.isArray).optional(),
  }),
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

// ---- 人物マークダウン一括保存 ----
export const saveCharactersMarkdownSchema = z.object({
  markdown: z.string(),
});

// ---- 年表マークダウン一括保存 ----
export const saveTimelinesMarkdownSchema = z.object({
  markdown: z.string(),
});

// ---- プロットマークダウン一括保存 ----
export const savePlotMarkdownSchema = z.object({
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

// ---- 設定マークダウン全体LLM編集 ----
export const editSettingDocumentSchema = z.object({
  instruction: z.string().min(1),
  markdown: z.string().min(1),
});

// ---- 人物マークダウン全体LLM編集 ----
export const editCharacterDocumentSchema = z.object({
  instruction: z.string().min(1),
  markdown: z.string().min(1),
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
  content: z.string(),
  role: z.enum(["user", "assistant", "system"]),
});

/**
 * AI SDK UIMessage の疎な zod スキーマ。
 * parts は { type: string } を最低限検証し、それ以外のフィールドは passthrough で許容する。
 * id は省略可能（サーバーは DB 履歴を正史とするため、クライアントの id は信用しない）。
 */
export const uiMessageSchema = z.object({
  id: z.string().optional(),
  parts: z.array(z.object({ type: z.string() }).passthrough()),
  role: z.enum(["user", "assistant", "system"]),
});

export const chatRequestSchema = z.object({
  messages: z.array(uiMessageSchema).min(1),
  modelConfigId: z.string().uuid().optional().nullable(),
  novelId: z.string().uuid().optional().nullable(),
  sessionId: z.string().uuid(),
});

export const extractChatEntitiesSchema = z.object({
  text: z.string().min(1),
});

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

// ---- カスタムプロンプト ----
export const promptCategorySchema = z.enum([
  "inline",
  "generation",
  "chat",
  "general",
]);

export const listCustomPromptsQuerySchema = z.object({
  category: promptCategorySchema.optional(),
  novelId: z.string().uuid().optional().nullable(),
});

export const createCustomPromptSchema = z.object({
  category: promptCategorySchema.optional().default("inline"),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  name: z.string().min(1),
  novelId: z.string().uuid().optional().nullable(),
  order: z.number().int().optional().default(0),
  systemPrompt: z.string().optional().nullable(),
  userPrompt: z.string().min(1),
});

export const updateCustomPromptSchema = z.object({
  category: promptCategorySchema.optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  order: z.number().int().optional(),
  systemPrompt: z.string().nullable().optional(),
  userPrompt: z.string().min(1).optional(),
});

// ---- 履歴 ----
export const listHistoriesQuerySchema = z.object({
  entityId: z.string().uuid().optional(),
  entityType: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  novelId: z.string().uuid(),
});

// ---- AI 分析結果 ----
export const analysisTypeSchema = z.enum([
  "story-arc",
  "check-voice",
  "persona-review",
]);

export const listAnalysisResultsQuerySchema = z.object({
  analysisType: analysisTypeSchema.optional(),
});

export const analysisResultParamsSchema = z.object({
  id: z.uuid(),
  resultId: z.uuid(),
});
