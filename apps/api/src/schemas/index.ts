import { z } from 'zod';
import { llmProviders } from '@novel-creator/shared';
import { foreshadowingStatusSchema } from '@novel-creator/shared/schemas';
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
} from '@novel-creator/db';

// ---- novels ----
export const createNovelSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  styleGuide: z.string().optional(),
  storyOutline: z.string().optional(),
});

export const updateNovelSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  styleGuide: z.string().nullable().optional(),
  storyOutline: z.string().nullable().optional(),
});

export const saveStoryOutlineSchema = z.object({
  markdown: z.string(),
});

export const editStoryOutlineSectionSchema = z.object({
  category: z.string(),
  name: z.string(),
  content: z.string(),
  instruction: z.string().min(1),
  markdown: z.string(),
  modelConfigId: z.string().optional().nullable(),
});

export const editStoryOutlineDocumentSchema = z.object({
  markdown: z.string(),
  instruction: z.string().min(1),
  modelConfigId: z.string().optional().nullable(),
});

export const generatePlotFromOutlineSchema = z.object({
  storyOutline: z.string().min(1),
  modelConfigId: z.string().optional().nullable(),
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

export const updateTimelineSchema = z.object({
  event: z.string().min(1).optional(),
  order: z.number().int().optional(),
  timestamp: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
});

// ---- foreshadowings ----
export const createForeshadowingSchema = z.object({
  title: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  status: foreshadowingStatusSchema.optional(),
  placedSectionId: z.string().uuid().optional().nullable(),
  resolvedSectionId: z.string().uuid().optional().nullable(),
});

export const updateForeshadowingSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.string().optional(),
  description: z.string().optional().nullable(),
  status: foreshadowingStatusSchema.optional(),
  placedSectionId: z.string().uuid().optional().nullable(),
  resolvedSectionId: z.string().uuid().optional().nullable(),
});

export const foreshadowingDraftSchema = z.object({
  instruction: z.string().min(1),
  currentDraft: z
    .object({
      category: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      status: foreshadowingStatusSchema.optional(),
    })
    .optional(),
});

export const saveForeshadowingsMarkdownSchema = z.object({
  markdown: z.string().min(1),
});

export const editForeshadowingSectionSchema = z.object({
  category: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: foreshadowingStatusSchema.optional(),
  instruction: z.string().min(1),
});

export const editForeshadowingDocumentSchema = z.object({
  markdown: z.string().min(1),
  instruction: z.string().min(1),
});

// ---- バックアップ ----
// バックアップの構造を緩く検証する。行レベルの厳密な検証は importNovel が行うため、
// ここでは rdb.novel の存在と各テーブルの配列形状のみを保証する。
// ワイヤ上の行は任意の JSON オブジェクトのため、ドメイン型（New* 行）へは
// 型ガード（z.custom）で復元する。検証の緩さ（wire format）は従来どおり。
const isRecordObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const backupBodySchema = z.object({
  meta: z.object({
    version: z.number(),
    novelId: z.string(),
    novelTitle: z.string().optional(),
    exportedAt: z.string().optional(),
  }),
  rdb: z.object({
    novel: z.custom<NewNovel>(isRecordObject),
    chapters: z.custom<NewChapter[]>(Array.isArray).optional(),
    sections: z.custom<NewSection[]>(Array.isArray).optional(),
    contents: z.custom<NewContent[]>(Array.isArray).optional(),
    characters: z.custom<NewCharacter[]>(Array.isArray).optional(),
    settings: z.custom<NewSetting[]>(Array.isArray).optional(),
    timelines: z.custom<NewTimeline[]>(Array.isArray).optional(),
    llmInstructions: z.custom<NewLlmInstruction[]>(Array.isArray).optional(),
    chatSessions: z.custom<NewChatSession[]>(Array.isArray).optional(),
    chatMessages: z.custom<NewChatMessage[]>(Array.isArray).optional(),
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

/**
 * AI SDK UIMessage の疎な zod スキーマ。
 * parts は { type: string } を最低限検証し、それ以外のフィールドは passthrough で許容する。
 * id は省略可能（サーバーは DB 履歴を正史とするため、クライアントの id は信用しない）。
 */
export const uiMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(z.object({ type: z.string() }).passthrough()),
});

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  novelId: z.string().uuid().optional().nullable(),
  messages: z.array(uiMessageSchema).min(1),
  modelConfigId: z.string().uuid().optional().nullable(),
});

export const extractChatEntitiesSchema = z.object({
  text: z.string().min(1),
});

// ---- LLM 設定 ----
export const createLlmConfigSchema = z.object({
  name: z.string().min(1),
  provider: z.enum(llmProviders),
  modelId: z.string().min(1),
  baseUrl: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  description: z.string().optional().nullable(),
});

export const updateLlmConfigSchema = z.object({
  name: z.string().min(1).optional(),
  provider: z.enum(llmProviders).optional(),
  modelId: z.string().min(1).optional(),
  baseUrl: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  description: z.string().optional().nullable(),
});

export const testLlmConfigSchema = z.object({
  provider: z.enum(llmProviders),
  modelId: z.string().min(1),
  baseUrl: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
});

// ---- Embedding 設定 ----
export const createEmbeddingConfigSchema = z.object({
  name: z.string().min(1),
  provider: z.enum(llmProviders),
  modelId: z.string().min(1),
  dimensions: z.coerce.number().int().positive().default(1536),
  baseUrl: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  description: z.string().optional().nullable(),
});

export const updateEmbeddingConfigSchema = z.object({
  name: z.string().min(1).optional(),
  provider: z.enum(llmProviders).optional(),
  modelId: z.string().min(1).optional(),
  dimensions: z.coerce.number().int().positive().optional(),
  baseUrl: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  description: z.string().optional().nullable(),
});

export const testEmbeddingConfigSchema = z.object({
  provider: z.enum(llmProviders),
  modelId: z.string().min(1),
  dimensions: z.coerce.number().int().positive().optional(),
  baseUrl: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
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
  selectedText: z.string().min(1),
  action: z.enum([
    'expand',
    'shorten',
    'emotional',
    'dialogue',
    'paraphrase',
    'custom',
    'template',
  ]),
  customInstruction: z.string().optional(),
  customPromptId: z.string().uuid().optional().nullable(),
  surroundingText: z.string().optional(),
  modelConfigId: z.string().uuid().optional().nullable(),
  variantCount: z.coerce.number().int().min(1).max(3).optional().default(1),
});

export const checkCharacterVoiceBodySchema = z.object({
  body: z.string().optional(),
  sectionId: z.string().uuid().optional(),
  modelConfigId: z.string().uuid().optional().nullable(),
});

export const analyzeSettingImpactBodySchema = z.object({
  changeTarget: z.enum(['character', 'setting']),
  targetName: z.string().min(1),
  beforeValue: z.string(),
  afterValue: z.string(),
  modelConfigId: z.string().uuid().optional().nullable(),
});

export const analyzeStoryArcBodySchema = modelConfigBodySchema;

export const multiPersonaReviewBodySchema = z.object({
  sectionId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
  body: z.string().optional(),
  modelConfigId: z.string().uuid().optional().nullable(),
});

export const generateStyleGuideDraftBodySchema = modelConfigBodySchema;

// ---- カスタムプロンプト ----
export const promptCategorySchema = z.enum(['inline', 'generation', 'chat', 'general']);

export const listCustomPromptsQuerySchema = z.object({
  novelId: z.string().uuid().optional().nullable(),
  category: promptCategorySchema.optional(),
});

export const createCustomPromptSchema = z.object({
  novelId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  category: promptCategorySchema.optional().default('inline'),
  systemPrompt: z.string().optional().nullable(),
  userPrompt: z.string().min(1),
  order: z.number().int().optional().default(0),
});

export const updateCustomPromptSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  category: promptCategorySchema.optional(),
  systemPrompt: z.string().nullable().optional(),
  userPrompt: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

// ---- 履歴 ----
export const listHistoriesQuerySchema = z.object({
  novelId: z.string().uuid(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

// ---- AI 分析結果 ----
export const analysisTypeSchema = z.enum(['story-arc', 'check-voice', 'persona-review']);

export const listAnalysisResultsQuerySchema = z.object({
  analysisType: analysisTypeSchema.optional(),
});

export const analysisResultParamsSchema = z.object({
  id: z.uuid(),
  resultId: z.uuid(),
});
