// フロント用の型定義。
// バックエンド（packages/db）との結合度を下げるため、ここで再定義する。

export interface Novel {
  id: string;
  title: string;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Chapter {
  id: string;
  novelId: string;
  title: string;
  order: number;
  summary: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Section {
  id: string;
  chapterId: string;
  title: string | null;
  order: number;
  summary: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Content {
  id: string;
  sectionId: string;
  body: string;
  wordCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Character {
  id: string;
  novelId: string;
  category: string;
  name: string;
  description: string | null;
  traits: string[] | null;
  relationships: unknown;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Setting {
  id: string;
  novelId: string;
  category: string;
  name: string;
  description: string | null;
  metadata: unknown;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Timeline {
  id: string;
  novelId: string;
  sectionId: string | null;
  event: string;
  order: number;
  timestamp: string | null;
  createdAt: string | null;
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

export interface LlmInstruction {
  id: string;
  novelId: string;
  entityType: string;
  instruction: string;
  createdAt: string | null;
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

export interface ExtractResult {
  timelines: Timeline[];
  settings: Setting[];
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
