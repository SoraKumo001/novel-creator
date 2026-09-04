import type { UIMessage } from "ai";

/**
 * チャット関連の Web Storage アクセスを集約するモジュール。
 *
 * 背景: localStorage / sessionStorage への直書きが ChatContext /
 * useChatStreaming / chatTransport / useChatDrawer（下書き・幅・配置）へ分散し、
 * 復元・リトライ・キャッシュの責務が混在していた。このモジュールにキー定数と
 * load / save / clear を集約し、呼び出し側は責務別の明示的な関数を使う。
 *
 * 方針:
 * - SSR（typeof window === "undefined"）では読み出しはフォールバック値を返し、
 *   書き込み・削除は no-op とする（挙動は従来の呼び出し側ガードと同一）。
 * - 読み書きの失敗（QuotaExceededError・JSON 破損等）はベストエフォートとして
 *   握りつぶし、呼び出し元の error state には波及させない。従来の try/catch と同一。
 * - 公開 API シグネチャは可能な限り維持する。chatTransport からの再エクスポートで
 *   既存 import パスを保つ。
 */

/** localStorage に永続化するチャット関連のキー定数 */
export const CHAT_STORAGE_KEYS = {
  /** チャットドロワーの開閉状態 ("true" / "false") */
  CHAT_OPEN: "novel-creator:chat-open",
  /** 現在のアクティブセッションID */
  ACTIVE_SESSION: "novel-creator:active-session",
  /** 選択中のチャット用モデル設定ID */
  CHAT_MODEL: "novel-creator:chat-model",
  /** ドロワー幅 */
  CHAT_WIDTH: "novel-creator:chat-width",
  /** ドロワー配置モード */
  CHAT_LAYOUT_MODE: "novel-creator:chat-layout-mode",
  /** エディタ用モデル設定ID（参照用に定数化。所有者はエディタ側） */
  EDITOR_MODEL: "novel-creator:editor-model",
  /** ナビゲーション折りたたみ状態（参照用に定数化。所有者は Nav 側） */
  NAV_COLLAPSED: "novel-creator:nav-collapsed",
} as const;

/** sessionStorage に保持するリトライ用最終プロンプトのキー */
export const LAST_PROMPT_STORAGE_KEY = "novel-creator:last-prompt";

/** sessionStorage 上のメッセージキャッシュ接頭辞 */
export const CHAT_MESSAGES_CACHE_PREFIX = "novel-creator:chat-cache:";

/** localStorage 上の下書き接頭辞 */
export const CHAT_DRAFT_PREFIX = "novel-creator:chat-draft:";

/** キャッシュに保持する最大件数（全文保存をやめ直近のみに軽量化する） */
export const CHAT_CACHE_MAX_MESSAGES = 50;

/** ドロワー幅の保存値 */
export type ChatDrawerWidth = "normal" | "wide" | "full";

/** ドロワー配置モードの保存値 */
export type ChatLayoutMode = "overlay" | "docked";

/** セッションごとのメッセージキャッシュキー */
export function chatCacheKey(sessionId: string): string {
  return `${CHAT_MESSAGES_CACHE_PREFIX}${sessionId}`;
}

/** セッションごとの下書きキー（null は新規相談用の "new" に正規化） */
export function chatDraftKey(sessionId: string | null): string {
  return `${CHAT_DRAFT_PREFIX}${sessionId ?? "new"}`;
}

function readLocalStorage(key: string): string | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    // 永続化はベストエフォートのため静かに破棄する
  }
}

function removeLocalStorage(key: string): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.removeItem(key);
  } catch {
    // 削除失敗は無視する
  }
}

function readSessionStorage(key: string): string | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    sessionStorage.setItem(key, value);
  } catch {
    // 永続化はベストエフォートのため静かに破棄する
  }
}

function removeSessionStorage(key: string): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    sessionStorage.removeItem(key);
  } catch {
    // 削除失敗は無視する
  }
}

// --- セッション復元責務: 開閉・アクティブセッション・モデル選択 ---

/** チャットドロワーの開閉状態を復元する（未保存時は false） */
export function loadChatOpen(): boolean {
  return readLocalStorage(CHAT_STORAGE_KEYS.CHAT_OPEN) === "true";
}

/** チャットドロワーの開閉状態を保存する */
export function saveChatOpen(open: boolean): void {
  writeLocalStorage(CHAT_STORAGE_KEYS.CHAT_OPEN, String(open));
}

/** リロード後に復元するアクティブセッションID（未保存時は null） */
export function loadActiveSessionId(): string | null {
  return readLocalStorage(CHAT_STORAGE_KEYS.ACTIVE_SESSION);
}

/** アクティブセッションIDを保存する。null で保存を削除する */
export function saveActiveSessionId(sessionId: string | null): void {
  if (sessionId) {
    writeLocalStorage(CHAT_STORAGE_KEYS.ACTIVE_SESSION, sessionId);
  } else {
    removeLocalStorage(CHAT_STORAGE_KEYS.ACTIVE_SESSION);
  }
}

/** 選択中のチャット用モデル設定ID（未保存時は null） */
export function loadChatModelId(): string | null {
  return readLocalStorage(CHAT_STORAGE_KEYS.CHAT_MODEL) || null;
}

/** 選択中のチャット用モデル設定IDを保存する。null で保存を削除する */
export function saveChatModelId(modelConfigId: string | null): void {
  if (modelConfigId) {
    writeLocalStorage(CHAT_STORAGE_KEYS.CHAT_MODEL, modelConfigId);
  } else {
    removeLocalStorage(CHAT_STORAGE_KEYS.CHAT_MODEL);
  }
}

// --- UI 設定責務: ドロワー幅・配置モード ---

function isChatDrawerWidth(value: string | null): value is ChatDrawerWidth {
  return value === "normal" || value === "wide" || value === "full";
}

/** ドロワー幅を復元する（未保存・破損時は "normal"） */
export function loadChatDrawerWidth(): ChatDrawerWidth {
  const saved = readLocalStorage(CHAT_STORAGE_KEYS.CHAT_WIDTH);
  return isChatDrawerWidth(saved) ? saved : "normal";
}

/** ドロワー幅を保存する */
export function saveChatDrawerWidth(width: ChatDrawerWidth): void {
  writeLocalStorage(CHAT_STORAGE_KEYS.CHAT_WIDTH, width);
}

function isChatLayoutMode(value: string | null): value is ChatLayoutMode {
  return value === "overlay" || value === "docked";
}

/** ドロワー配置モードを復元する（未保存・破損時は "docked"） */
export function loadChatLayoutMode(): ChatLayoutMode {
  const saved = readLocalStorage(CHAT_STORAGE_KEYS.CHAT_LAYOUT_MODE);
  return isChatLayoutMode(saved) ? saved : "docked";
}

/** ドロワー配置モードを保存する */
export function saveChatLayoutMode(mode: ChatLayoutMode): void {
  writeLocalStorage(CHAT_STORAGE_KEYS.CHAT_LAYOUT_MODE, mode);
}

// --- リトライ責務: 最終プロンプトの永続化 ---

/** リトライ用に永続化された最終プロンプト（失敗時は null のベストエフォート） */
export function loadLastPrompt(): string | null {
  return readSessionStorage(LAST_PROMPT_STORAGE_KEY);
}

/** 最終プロンプトをリトライ用に永続化する */
export function saveLastPrompt(prompt: string): void {
  writeSessionStorage(LAST_PROMPT_STORAGE_KEY, prompt);
}

/** 永続化された最終プロンプトを削除する */
export function clearLastPrompt(): void {
  removeSessionStorage(LAST_PROMPT_STORAGE_KEY);
}

// --- 下書き責務: セッションごとの入力下書き ---

/** セッションごとの下書きを復元する（未保存時は null） */
export function loadChatDraft(sessionId: string | null): string | null {
  return readLocalStorage(chatDraftKey(sessionId));
}

/**
 * セッションごとの下書きを保存する。空文字は保存を削除する。
 * デバウンス済みの呼び出し元から使う想定の同期 API。
 */
export function saveChatDraft(sessionId: string | null, value: string): void {
  const key = chatDraftKey(sessionId);
  if (value) {
    writeLocalStorage(key, value);
  } else {
    removeLocalStorage(key);
  }
}

/** セッションごとの下書きを削除する */
export function clearChatDraft(sessionId: string | null): void {
  removeLocalStorage(chatDraftKey(sessionId));
}

// --- キャッシュ責務: セッションごとのメッセージキャッシュ ---

function isUIMessageArray(parsed: unknown): parsed is UIMessage[] {
  return (
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    parsed.every(
      (item): item is UIMessage =>
        typeof item === "object" && item !== null && "id" in item
    )
  );
}

/** キャッシュ済みメッセージの読み出し（失敗時は null を返すベストエフォート） */
export function loadCachedMessages(sessionId: string): UIMessage[] | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    const cached = sessionStorage.getItem(chatCacheKey(sessionId));
    if (!cached) {
      return null;
    }
    const parsed: unknown = JSON.parse(cached);
    if (isUIMessageArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** キャッシュ済みメッセージの保存（直近のみ）。
 * QuotaExceededError 等で失敗した場合は例外を送出し、呼び出し側
 *（useChatStreaming のキャッシュ同期 effect）が error state へ反映する。
 * リトライ表示に必要な可視化のため、読み出し側と異なり握り潰さない。
 * SSR（window 不在）時は no-op で成功扱いとする。
 */
export function saveCachedMessages(
  sessionId: string,
  messages: UIMessage[]
): void {
  if (typeof window === "undefined") {
    return;
  }
  const recent = messages.slice(-CHAT_CACHE_MAX_MESSAGES);
  sessionStorage.setItem(chatCacheKey(sessionId), JSON.stringify(recent));
}

/** セッションのメッセージキャッシュを削除する */
export function clearCachedMessages(sessionId: string): void {
  removeSessionStorage(chatCacheKey(sessionId));
}

// --- 他領域のキー参照用（所有者は各領域。ここでは定数化のみ） ---

/** エディタ用モデル設定ID（所有者はエディタ側。ここでは参照用に提供） */
export function loadEditorModelId(): string | null {
  return readLocalStorage(CHAT_STORAGE_KEYS.EDITOR_MODEL) || null;
}

/** エディタ用モデル設定IDの保存（所有者はエディタ側。ここでは参照用に提供） */
export function saveEditorModelId(modelConfigId: string | null): void {
  if (modelConfigId) {
    writeLocalStorage(CHAT_STORAGE_KEYS.EDITOR_MODEL, modelConfigId);
  } else {
    removeLocalStorage(CHAT_STORAGE_KEYS.EDITOR_MODEL);
  }
}

/** ナビゲーション折りたたみ状態（所有者は Nav 側。ここでは参照用に提供） */
export function loadNavCollapsed(): boolean {
  return readLocalStorage(CHAT_STORAGE_KEYS.NAV_COLLAPSED) === "true";
}

/** ナビゲーション折りたたみ状態の保存（所有者は Nav 側。ここでは参照用に提供） */
export function saveNavCollapsed(collapsed: boolean): void {
  writeLocalStorage(CHAT_STORAGE_KEYS.NAV_COLLAPSED, String(collapsed));
}

// --- セッション終了時の一括クリア ---

/**
 * セッションに紐づく一時状態（メッセージキャッシュ・下書き・リトライ用
 * プロンプト）を一括削除する。アクティブセッションID自体が対象セッションを
 * 指している場合のみ保存も削除する。セッション削除時の後始末用。
 */
export function clearChatSessionState(sessionId: string): void {
  clearCachedMessages(sessionId);
  clearChatDraft(sessionId);
  clearLastPrompt();
  if (loadActiveSessionId() === sessionId) {
    saveActiveSessionId(null);
  }
}
