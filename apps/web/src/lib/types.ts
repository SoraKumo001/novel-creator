// フロント用の型定義。
// エンティティ型は @novel-creator/shared/schemas を単一情報源とし、
// ここではビューモデルと入力型のみを定義する。
import type { LLMProviderType } from "@novel-creator/shared";
import type {
  Chapter,
  Character,
  ChatMessageItem,
  ChatSession,
  Content,
  CustomPrompt,
  Foreshadowing,
  ForeshadowingStatus,
  LlmInstruction,
  Novel,
  Section,
  Setting,
  Timeline,
} from "@novel-creator/shared/schemas";

export type {
  Chapter,
  Character,
  ChatMessageItem,
  ChatSession,
  Content,
  CustomPrompt,
  Foreshadowing,
  ForeshadowingStatus,
  LlmInstruction,
  Novel,
  Section,
  Setting,
  Timeline,
};

export interface CreateForeshadowingInput {
  category?: string;
  description?: string;
  placedSectionId?: string | null;
  resolvedSectionId?: string | null;
  status?: ForeshadowingStatus;
  title: string;
}

export interface UpdateForeshadowingInput {
  category?: string;
  description?: string | null;
  placedSectionId?: string | null;
  resolvedSectionId?: string | null;
  status?: ForeshadowingStatus;
  title?: string;
}

// 小説詳細（関連データ含む）
export interface NovelDetail extends Novel {
  chapters: Chapter[];
  characters: Character[];
  settings: Setting[];
}

// 章・節のツリー表現
export interface ChapterWithSections extends Chapter {
  sections: Section[];
}

export interface SectionWithContent extends Section {
  content: Content | null;
}

// 入力型
export interface CreateNovelInput {
  description?: string;
  storyOutline?: string | null;
  styleGuide?: string | null;
  title: string;
}

export interface UpdateNovelInput {
  description?: string;
  storyOutline?: string | null;
  styleGuide?: string | null;
  title?: string;
}

export interface CreateChapterInput {
  order?: number;
  summary?: string;
  title: string;
}

export interface UpdateChapterInput {
  order?: number;
  summary?: string;
  title?: string;
}

export interface CreateSectionInput {
  order?: number;
  summary?: string;
  title?: string;
}

export interface UpdateSectionInput {
  order?: number;
  summary?: string;
  title?: string;
}

export interface UpdateContentInput {
  body: string;
}

export interface CreateCharacterInput {
  category?: string;
  description?: string;
  name: string;
  relationships?: unknown;
  traits?: string[];
}

export interface UpdateCharacterInput {
  category?: string;
  description?: string;
  name?: string;
  relationships?: unknown;
  traits?: string[];
}

export interface CreateSettingInput {
  category: string;
  description?: string;
  metadata?: unknown;
  name: string;
}

export interface UpdateSettingInput {
  category?: string;
  description?: string;
  metadata?: unknown;
  name?: string;
}

export interface CreateTimelineInput {
  event: string;
  order?: number;
  sectionId?: string;
  timestamp?: string;
}

export interface UpdateTimelineInput {
  event?: string;
  order?: number;
  sectionId?: string | null;
  timestamp?: string | null;
}

export interface EditInstructionInput {
  instruction: string;
}

export interface SettingDraft {
  category: string;
  description: string;
  name: string;
}

export interface SettingDraftInput {
  currentDraft?: { category: string; name: string; description?: string };
  instruction: string;
}

export interface CreateLlmInstructionInput {
  entityType: string;
  instruction: string;
}

// 生成系レスポンス型
export interface GeneratedPlot {
  chapters: {
    title: string;
    order: number;
    summary: string;
  }[];
  description: string;
  title: string;
}

export interface GeneratedSummary {
  order: number;
  summary: string;
  title: string;
}

export interface ExtractedTimelineItem {
  event: string;
  id?: string;
  order: number;
  timestamp?: string | null;
}

export interface ExtractedSettingItem {
  category: string;
  description?: string | null;
  id?: string;
  name: string;
}

export interface ExtractResult {
  settings: ExtractedSettingItem[];
  timelines: ExtractedTimelineItem[];
}

export interface ApiSuccessResponse {
  success: true;
}

// 設定マークダウン一括保存レスポンス
export interface SaveSettingsMarkdownResult {
  created: number;
  deleted: number;
  duplicateCount: number;
  updated: number;
}

// 設定セクションLLM編集レスポンス
export interface EditSettingSectionResult {
  markdown: string;
}

// 人物マークダウン一括保存レスポンス
export interface SaveCharactersMarkdownResult {
  created: number;
  deleted: number;
  duplicateCount: number;
  updated: number;
}

// 人物セクションLLM編集レスポンス
export interface EditCharacterSectionResult {
  markdown: string;
}

// ---- チャットセッション ----
/** セッション詳細に含まれるメッセージ行。
 * バックエンドが返す UI Message パーツ（jsonb）を保持する（無ければ null）。
 */
export interface ChatDetailMessage extends ChatMessageItem {
  parts?: unknown[] | null;
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatDetailMessage[];
}

export interface CreateChatSessionInput {
  novelId?: string;
  title?: string;
}

export interface UpdateChatSessionInput {
  title: string;
}

// チャットからのエンティティ抽出型
export interface ExtractedCharacterItem {
  category: string;
  description: string;
  name: string;
  traits: string[];
}

export interface ExtractedChatForeshadowingItem {
  description: string;
  status: "unresolved" | "resolved" | "abandoned";
  title: string;
}

export interface ExtractedChatTimelineItem {
  event: string;
  timestamp?: string | null;
}

export interface ExtractedChatPlotItem {
  summary: string;
  title: string;
}

export interface ExtractedChatEntities {
  characters: ExtractedCharacterItem[];
  foreshadowings?: ExtractedChatForeshadowingItem[];
  plots?: ExtractedChatPlotItem[];
  settings: ExtractedSettingItem[];
  timelines?: ExtractedChatTimelineItem[];
}

// ---- バックアップ・リストア ----
export interface BackupMeta {
  exportedAt: string;
  novelId: string;
  novelTitle: string;
  version: number;
}

export interface BackupData {
  meta: BackupMeta;
  rdb: Record<string, unknown[]>;
}

export interface ImportResult {
  counts: Record<string, number>;
  novelId: string;
  success: true;
}

// ---- 校正・推敲 ----
export interface ProofreadIssue {
  originalText: string;
  reason: string;
  suggestion: string;
  type: "viewpoint" | "typo" | "grammar" | "pacing" | "consistency" | "other";
}

export interface ProofreadResult {
  advice: string;
  critique: string;
  issues: ProofreadIssue[];
  polishedBody: string;
  score: number;
}

// ---- LLM 設定 ----
export interface LLMConfig {
  apiKeyMasked: string | null;
  baseUrl: string | null;
  createdAt: string | Date | null;
  description: string | null;
  hasApiKey: boolean;
  id: string;
  isDefault: boolean;
  modelId: string;
  name: string;
  provider: LLMProviderType;
  updatedAt: string | Date | null;
}

export interface CreateLLMConfigInput {
  apiKey?: string | null;
  baseUrl?: string | null;
  description?: string | null;
  isDefault?: boolean;
  modelId: string;
  name: string;
  provider: LLMProviderType;
}

export interface UpdateLLMConfigInput {
  apiKey?: string | null;
  baseUrl?: string | null;
  description?: string | null;
  isDefault?: boolean;
  modelId?: string;
  name?: string;
  provider?: LLMProviderType;
}

export interface TestConnectionInput {
  apiKey?: string | null;
  baseUrl?: string | null;
  modelId: string;
  provider: LLMProviderType;
}

export interface TestConnectionResult {
  error?: string;
  latencyMs: number;
  message: string;
  success: boolean;
}

// ---- Embedding 設定 ----
export interface EmbeddingConfig {
  apiKeyMasked: string | null;
  baseUrl: string | null;
  createdAt: string | Date | null;
  description: string | null;
  dimensions: number;
  hasApiKey: boolean;
  id: string;
  isDefault: boolean;
  modelId: string;
  name: string;
  provider: LLMProviderType;
  updatedAt: string | Date | null;
}

export interface CreateEmbeddingConfigInput {
  apiKey?: string | null;
  baseUrl?: string | null;
  description?: string | null;
  dimensions?: number;
  isDefault?: boolean;
  modelId: string;
  name: string;
  provider: LLMProviderType;
}

export interface UpdateEmbeddingConfigInput {
  apiKey?: string | null;
  baseUrl?: string | null;
  description?: string | null;
  dimensions?: number;
  isDefault?: boolean;
  modelId?: string;
  name?: string;
  provider?: LLMProviderType;
}

export interface TestEmbeddingConnectionInput {
  apiKey?: string | null;
  baseUrl?: string | null;
  dimensions?: number;
  modelId: string;
  provider: LLMProviderType;
}

export interface ReindexProgressEvent {
  current: number;
  error?: string;
  itemTitle?: string;
  percent: number;
  stage: string;
  total: number;
}

// ---- インラインAIアシスト ----
export type InlineAssistAction =
  | "expand"
  | "shorten"
  | "emotional"
  | "dialogue"
  | "paraphrase"
  | "custom"
  | "template";

export interface InlineAssistInput {
  action: InlineAssistAction;
  customInstruction?: string;
  customPromptId?: string | null;
  modelConfigId?: string | null;
  selectedText: string;
  surroundingText?: string;
  variantCount?: number;
}

export interface CreateCustomPromptInput {
  category?: "inline" | "generation" | "chat" | "general";
  description?: string | null;
  icon?: string | null;
  name: string;
  novelId?: string | null;
  order?: number;
  systemPrompt?: string | null;
  userPrompt: string;
}

export interface UpdateCustomPromptInput {
  category?: "inline" | "generation" | "chat" | "general";
  description?: string | null;
  icon?: string | null;
  name?: string;
  order?: number;
  systemPrompt?: string | null;
  userPrompt?: string;
}

// ---- 口調・一貫性チェック ----
export interface CharacterVoiceIssue {
  characterName: string;
  dialogue: string;
  issueType:
    | "firstPerson"
    | "secondPerson"
    | "speechPattern"
    | "toneShift"
    | "outOfCharacter";
  reason: string;
  suggestion: string;
}

export interface CharacterVoiceCheckResult {
  issues: CharacterVoiceIssue[];
  summary: string;
}

// ---- 設定変更影響分析 ----
export interface SettingImpactItem {
  issue: string;
  suggestedFix: string;
  targetTitle: string;
  targetType: "plot" | "section" | "timeline" | "foreshadowing";
}

export interface SettingImpactResult {
  affectedItems: SettingImpactItem[];
  impactLevel: "low" | "medium" | "high";
  summary: string;
}

// ---- ストーリーアーク・テンション分析 ----
export interface StoryArcDataPoint {
  advice: string;
  chapterId: string;
  chapterTitle: string;
  keyEvent: string;
  pacing: number;
  sectionId: string;
  sectionTitle: string;
  tension: number;
  valence: number;
}

export interface StoryArcResult {
  dataPoints: StoryArcDataPoint[];
  pacingCritique: string;
  summary: string;
}

// ---- 複数ペルソナ模擬読者レビュー ----
export type ReaderPersonaType = "editor" | "casual" | "lore" | "critic";

export interface ReaderPersonaReview {
  advice: string;
  catchphrase: string;
  criticism: string;
  persona: ReaderPersonaType;
  personaName: string;
  praise: string;
  rating: number;
}

export interface MultiPersonaReviewResult {
  overallImpression: string;
  reviews: ReaderPersonaReview[];
}

// ---- 認証・ユーザー・メンバー ----
export type UserRole = "admin" | "user";

export type NovelMemberRole = "owner" | "admin" | "editor" | "viewer";

/** 初版メンバーUIの二値表示 (owner / admin) */
export type NovelMemberDisplayRole = "owner" | "admin";

export interface AuthUser {
  disabled?: boolean | null;
  email: string;
  id: string;
  name?: string | null;
  role: UserRole;
}

export interface AuthSession {
  user: AuthUser | null;
}

export interface AuthStatus {
  initialized: boolean;
}

export interface AdminUser extends AuthUser {
  createdAt?: string | null;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  disabled?: boolean;
  role?: UserRole;
}

export interface NovelMember {
  email?: string | null;
  role: NovelMemberRole;
  userId: string;
}

export interface AddNovelMemberInput {
  email?: string;
  role: NovelMemberDisplayRole;
  userId?: string;
}

// ---- AI分析（ストーリーアーク / 口調チェック / ペルソナレビュー）----
export type AnalysisType = "story-arc" | "check-voice" | "persona-review";

/** SSE 進捗イベント。stage は表示用日本語ラベル。total が 0 の場合は不定間隔（インジケーター表示用）。 */
export interface AnalysisProgress {
  current: number;
  stage: string;
  total: number;
}

/** 保存済み分析結果の履歴エントリ。result の実際の型は analysisType で判別してキャストすること。 */
export interface AnalysisHistoryEntry {
  analysisType: AnalysisType;
  createdAt: string;
  id: string;
  novelId: string;
  result: StoryArcResult | CharacterVoiceCheckResult | MultiPersonaReviewResult;
  targetChapterId: string | null;
  targetSectionId: string | null;
}
