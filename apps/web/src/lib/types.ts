// フロント用の型定義。
// エンティティ型は @novel-creator/shared/schemas を単一情報源とし、
// ここではビューモデルと入力型のみを定義する。
import type {
  Novel,
  Chapter,
  Section,
  Content,
  Character,
  Setting,
  Timeline,
  Foreshadowing,
  ForeshadowingStatus,
  LlmInstruction,
  ChatSession,
  ChatMessageItem,
} from '@novel-creator/shared/schemas';

export type {
  Novel,
  Chapter,
  Section,
  Content,
  Character,
  Setting,
  Timeline,
  Foreshadowing,
  ForeshadowingStatus,
  LlmInstruction,
  ChatSession,
  ChatMessageItem,
};

export interface CreateForeshadowingInput {
  title: string;
  description?: string;
  status?: ForeshadowingStatus;
  placedSectionId?: string | null;
  resolvedSectionId?: string | null;
}

export interface UpdateForeshadowingInput {
  title?: string;
  description?: string | null;
  status?: ForeshadowingStatus;
  placedSectionId?: string | null;
  resolvedSectionId?: string | null;
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
  title: string;
  description?: string;
}

export interface UpdateNovelInput {
  title?: string;
  description?: string;
}

export interface CreateChapterInput {
  title: string;
  order?: number;
  summary?: string;
}

export interface UpdateChapterInput {
  title?: string;
  order?: number;
  summary?: string;
}

export interface CreateSectionInput {
  title?: string;
  order?: number;
  summary?: string;
}

export interface UpdateSectionInput {
  title?: string;
  order?: number;
  summary?: string;
}

export interface UpdateContentInput {
  body: string;
}

export interface CreateCharacterInput {
  category?: string;
  name: string;
  description?: string;
  traits?: string[];
  relationships?: unknown;
}

export interface UpdateCharacterInput {
  category?: string;
  name?: string;
  description?: string;
  traits?: string[];
  relationships?: unknown;
}

export interface CreateSettingInput {
  category: string;
  name: string;
  description?: string;
  metadata?: unknown;
}

export interface UpdateSettingInput {
  category?: string;
  name?: string;
  description?: string;
  metadata?: unknown;
}

export interface CreateTimelineInput {
  event: string;
  order?: number;
  timestamp?: string;
  sectionId?: string;
}

export interface EditInstructionInput {
  instruction: string;
}

export interface SettingDraft {
  category: string;
  name: string;
  description: string;
}

export interface SettingDraftInput {
  instruction: string;
  currentDraft?: { category: string; name: string; description?: string };
}

export interface CreateLlmInstructionInput {
  entityType: string;
  instruction: string;
}

// 生成系レスポンス型
export interface GeneratedPlot {
  title: string;
  description: string;
  chapters: {
    title: string;
    order: number;
    summary: string;
  }[];
}

export interface GeneratedSummary {
  title: string;
  order: number;
  summary: string;
}

export interface ExtractedTimelineItem {
  id?: string;
  event: string;
  order: number;
  timestamp?: string | null;
}

export interface ExtractedSettingItem {
  id?: string;
  name: string;
  category: string;
  description?: string | null;
}

export interface ExtractResult {
  timelines: ExtractedTimelineItem[];
  settings: ExtractedSettingItem[];
}

export interface ApiSuccessResponse {
  success: true;
}

// 設定マークダウン一括保存レスポンス
export interface SaveSettingsMarkdownResult {
  created: number;
  updated: number;
  deleted: number;
  duplicateCount: number;
}

// 設定セクションLLM編集レスポンス
export interface EditSettingSectionResult {
  markdown: string;
}

// 人物マークダウン一括保存レスポンス
export interface SaveCharactersMarkdownResult {
  created: number;
  updated: number;
  deleted: number;
  duplicateCount: number;
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
  name: string;
  category: string;
  description: string;
  traits: string[];
}

export interface ExtractedChatEntities {
  characters: ExtractedCharacterItem[];
  settings: ExtractedSettingItem[];
}

// ---- バックアップ・リストア ----
export interface BackupMeta {
  version: number;
  novelId: string;
  novelTitle: string;
  exportedAt: string;
}

export interface BackupData {
  meta: BackupMeta;
  rdb: Record<string, unknown[]>;
}

export interface ImportResult {
  success: true;
  novelId: string;
  counts: Record<string, number>;
}

// ---- 校正・推敲 ----
export interface ProofreadIssue {
  type: 'viewpoint' | 'typo' | 'grammar' | 'pacing' | 'consistency' | 'other';
  originalText: string;
  suggestion: string;
  reason: string;
}

export interface ProofreadResult {
  score: number;
  critique: string;
  advice: string;
  issues: ProofreadIssue[];
  polishedBody: string;
}

// ---- LLM 設定 ----
export interface LLMConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai';
  modelId: string;
  baseUrl: string | null;
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  isDefault: boolean;
  description: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

export interface CreateLLMConfigInput {
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai';
  modelId: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  isDefault?: boolean;
  description?: string | null;
}

export interface UpdateLLMConfigInput {
  name?: string;
  provider?: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai';
  modelId?: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  isDefault?: boolean;
  description?: string | null;
}

export interface TestConnectionInput {
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai';
  modelId: string;
  baseUrl?: string | null;
  apiKey?: string | null;
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs: number;
  message: string;
  error?: string;
}

// ---- インラインAIアシスト ----
export type InlineAssistAction =
  'expand' | 'shorten' | 'emotional' | 'dialogue' | 'paraphrase' | 'custom';

export interface InlineAssistInput {
  selectedText: string;
  action: InlineAssistAction;
  customInstruction?: string;
  surroundingText?: string;
  modelConfigId?: string | null;
}

// ---- 口調・一貫性チェック ----
export interface CharacterVoiceIssue {
  characterName: string;
  dialogue: string;
  issueType: 'firstPerson' | 'secondPerson' | 'speechPattern' | 'toneShift' | 'outOfCharacter';
  reason: string;
  suggestion: string;
}

export interface CharacterVoiceCheckResult {
  summary: string;
  issues: CharacterVoiceIssue[];
}

// ---- 設定変更影響分析 ----
export interface SettingImpactItem {
  targetType: 'plot' | 'section' | 'timeline' | 'foreshadowing';
  targetTitle: string;
  issue: string;
  suggestedFix: string;
}

export interface SettingImpactResult {
  summary: string;
  impactLevel: 'low' | 'medium' | 'high';
  affectedItems: SettingImpactItem[];
}

// ---- ストーリーアーク・テンション分析 ----
export interface StoryArcDataPoint {
  chapterId: string;
  chapterTitle: string;
  sectionId: string;
  sectionTitle: string;
  tension: number;
  valence: number;
  pacing: number;
  keyEvent: string;
  advice: string;
}

export interface StoryArcResult {
  summary: string;
  pacingCritique: string;
  dataPoints: StoryArcDataPoint[];
}

// ---- 複数ペルソナ模擬読者レビュー ----
export type ReaderPersonaType = 'editor' | 'casual' | 'lore' | 'critic';

export interface ReaderPersonaReview {
  persona: ReaderPersonaType;
  personaName: string;
  rating: number;
  catchphrase: string;
  praise: string;
  criticism: string;
  advice: string;
}

export interface MultiPersonaReviewResult {
  overallImpression: string;
  reviews: ReaderPersonaReview[];
}
