export const REQUIRED_TITLE_MESSAGE = "タイトルを入力してください";

export const NOVEL_FIELD_LABELS = {
  title: "タイトル",
  description: "説明",
  targetWordCount: "目標文字数",
  styleGuide: "スタイルガイド",
} as const;

export const EMPTY_NOVELS_TITLE = "まだ小説がありません";
export const EMPTY_NOVELS_DESCRIPTION =
  "新規作成ボタンから、最初の物語を作り始めましょう。";
export const EMPTY_HISTORY_MESSAGE = "まだ編集履歴がありません";
export const EMPTY_CHAT_SESSION_MESSAGE = "まだ相談履歴はありません。";
export const EMPTY_SEARCH_SESSION_MESSAGE =
  "検索条件に一致する相談履歴はありません。";

export const EMPTY_TEXT = {
  novelsTitle: EMPTY_NOVELS_TITLE,
  novelsDescription: EMPTY_NOVELS_DESCRIPTION,
  history: EMPTY_HISTORY_MESSAGE,
  chatSession: EMPTY_CHAT_SESSION_MESSAGE,
  chatSessionSearch: EMPTY_SEARCH_SESSION_MESSAGE,
} as const;

export const LOADING_MESSAGES = {
  novels: "読み込み中...",
  history: "履歴を読み込み中...",
  chat: "メッセージを読み込み中...",
} as const;

export type LoadingMessageKey = keyof typeof LOADING_MESSAGES;

export function loadingMessage(key: LoadingMessageKey): string {
  return LOADING_MESSAGES[key];
}
