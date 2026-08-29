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
export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessageItem[];
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
