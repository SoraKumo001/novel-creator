/**
 * クエリキーの命名規約。
 * 小説配下のデータは ['novels', novelId, ...] プレフィックスで統一し、
 * invalidQueries をプレフィックス一致で一括無効化できるようにする。
 */
export const novelKeys = {
  all: ['novels'] as const,
  detail: (novelId: string) => ['novels', novelId] as const,
  chapters: (novelId: string) => ['novels', novelId, 'chapters'] as const,
  characters: (novelId: string) => ['novels', novelId, 'characters'] as const,
  charactersMarkdown: (novelId: string) => ['novels', novelId, 'characters', 'markdown'] as const,
  settings: (novelId: string) => ['novels', novelId, 'settings'] as const,
  settingsMarkdown: (novelId: string) => ['novels', novelId, 'settings', 'markdown'] as const,
  timelines: (novelId: string) => ['novels', novelId, 'timelines'] as const,
  foreshadowings: (novelId: string) => ['novels', novelId, 'foreshadowings'] as const,
  llmInstructions: (novelId: string, entityType: string) =>
    ['novels', novelId, 'llmInstructions', entityType] as const,
};

export const sectionKeys = {
  all: ['sections'] as const,
  detail: (sectionId: string) => ['sections', sectionId] as const,
  content: (sectionId: string) => ['sections', sectionId, 'content'] as const,
};

export const historyKeys = {
  all: ['histories'] as const,
  list: (novelId: string, entityType?: string, entityId?: string) =>
    ['histories', novelId, entityType, entityId] as const,
};

/**
 * チャット関連のクエリキー。
 * セッション一覧は小説ID単位でキャッシュし、novelId 未指定時は 'all' として扱う。
 * invalidateQueries はプレフィックス ['chat'] で一括無効化できる。
 */
export const chatKeys = {
  all: ['chat'] as const,
  sessions: (novelId?: string) => ['chat', 'sessions', novelId ?? 'all'] as const,
};

export const llmConfigKeys = {
  all: ['llmConfigs'] as const,
  detail: (id: string) => ['llmConfigs', id] as const,
};
