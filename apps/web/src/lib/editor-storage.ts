/**
 * Markdownエディタ関連の Web Storage アクセスを集約するモジュール。
 *
 * 背景: サイドバー幅・モード・開閉、プレビューモード、Monaco のフォントサイズ・
 * 折返し設定の localStorage 直書きが -EntityMarkdownEditor /
 * useMarkdownEntityEditor / -MarkdownEditorCore へ分散し、キー文字列と
 * 読み書きガードが重複していた。このモジュールにキー定数（サフィックス）と
 * load / save / clear を集約し、呼び出し側は責務別の明示的な関数を使う。
 * （`@/lib/chat-storage` と同一パターン）
 *
 * 方針:
 * - storageKey は呼び出し側（エンティティ種別 + novelId）で組み立て済みのものを
 *   受け取り、ここではサフィックス定数のみを付与する。
 * - 読み書き失敗時はベストエフォートとして握りつぶし、呼び出し元の
 *   error state には波及させない。従来の try/catch と同一。
 * - キー形式（`${storageKey}:monaco-font-size` 等）は従来通り維持する。
 *   既存の保存値を引き継ぐため、リネームは行わない。
 */

/** エディタ設定キーに付与するサフィックス定数 */
export const EDITOR_STORAGE_SUFFIXES = {
  /** サイドバー分割幅 */
  SIDEBAR_WIDTH: ":sidebar-width",
  /** サイドバー表示モード（pinned / overlap） */
  SIDEBAR_MODE: ":sidebar-mode",
  /** サイドバー開閉状態（"true" / "false"） */
  SIDEBAR_OPEN: ":sidebar-open",
  /** プレビュードックの表示モード */
  PREVIEW_MODE: ":preview-mode",
  /** Monaco エディタの文字サイズ */
  MONACO_FONT_SIZE: ":monaco-font-size",
  /** Monaco エディタの折返し設定 */
  MONACO_WORD_WRAP: ":monaco-word-wrap",
} as const;

export type EditorStorageSuffix =
  (typeof EDITOR_STORAGE_SUFFIXES)[keyof typeof EDITOR_STORAGE_SUFFIXES];

/** storageKey にサフィックスを付与した完全な保存キーを組み立てる */
export function editorStorageKey(
  storageKey: string,
  suffix: EditorStorageSuffix
): string {
  return `${storageKey}${suffix}`;
}

function readSetting(key: string): string | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    // 永続化はベストエフォートのため静かに破棄する
  }
}

function removeSetting(key: string): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.removeItem(key);
  } catch {
    // 削除失敗は無視する
  }
}

// --- 汎用設定責務: 任意キー（サイドバーリサイズ等）の読み書き ---

/**
 * 任意キーの設定値を読み出す（useSidebarResize / usePersistedState 用の低層 API）。
 * 未保存・利用不可時は null。
 */
export function readEditorSetting(key: string): string | null {
  return readSetting(key);
}

/** 任意キーの設定値を保存する（ベストエフォート） */
export function writeEditorSetting(key: string, value: string): void {
  writeSetting(key, value);
}

/** 任意キーの設定値を削除する */
export function removeEditorSetting(key: string): void {
  removeSetting(key);
}

// --- Monaco 設定責務: フォントサイズ・折返し ---

/** Monaco エディタ文字サイズの既定値（従来表示を維持） */
export const MONACO_FONT_SIZE_DEFAULT = 15;

/** Monaco エディタ文字サイズの最小値 */
export const MONACO_FONT_SIZE_MIN = 10;

/** Monaco エディタ文字サイズの最大値 */
export const MONACO_FONT_SIZE_MAX = 24;

/** Monaco エディタの折返し設定値 */
export type MonacoWordWrap = "on" | "off";

/** 文字サイズを許容範囲に収める */
export function clampMonacoFontSize(size: number): number {
  if (!Number.isFinite(size)) {
    return MONACO_FONT_SIZE_DEFAULT;
  }
  return Math.max(MONACO_FONT_SIZE_MIN, Math.min(MONACO_FONT_SIZE_MAX, size));
}

/** 保存されていた文字サイズを復元する（未保存・破損時は既定値 15） */
export function loadMonacoFontSize(storageKey: string): number {
  const saved = readSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.MONACO_FONT_SIZE)
  );
  if (saved === null) {
    return MONACO_FONT_SIZE_DEFAULT;
  }
  return clampMonacoFontSize(Number.parseInt(saved, 10));
}

/** 文字サイズを保存する（範囲外はクランプして保存） */
export function saveMonacoFontSize(storageKey: string, size: number): void {
  writeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.MONACO_FONT_SIZE),
    String(clampMonacoFontSize(size))
  );
}

/** 保存されていた折返し設定を復元する（未保存時は "on"） */
export function loadMonacoWordWrap(storageKey: string): MonacoWordWrap {
  const saved = readSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.MONACO_WORD_WRAP)
  );
  return saved === "off" ? "off" : "on";
}

/** 折返し設定を保存する */
export function saveMonacoWordWrap(
  storageKey: string,
  wordWrap: MonacoWordWrap
): void {
  writeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.MONACO_WORD_WRAP),
    wordWrap
  );
}

// --- サイドバー責務: モード・開閉 ---

/** エディタ横サイドバーの表示モード */
export type EditorSidebarMode = "pinned" | "overlap";

/** 保存されていたサイドバーモードを復元する（未保存時は "pinned"） */
export function loadSidebarMode(storageKey: string): EditorSidebarMode {
  const saved = readSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.SIDEBAR_MODE)
  );
  return saved === "overlap" ? "overlap" : "pinned";
}

/** サイドバーモードを保存する */
export function saveSidebarMode(
  storageKey: string,
  mode: EditorSidebarMode
): void {
  writeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.SIDEBAR_MODE),
    mode
  );
}

/** 保存されていたサイドバー開閉状態を復元する（未保存時は開） */
export function loadSidebarOpen(storageKey: string): boolean {
  const saved = readSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.SIDEBAR_OPEN)
  );
  return saved !== null ? saved === "true" : true;
}

/** サイドバー開閉状態を保存する */
export function saveSidebarOpen(storageKey: string, open: boolean): void {
  writeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.SIDEBAR_OPEN),
    String(open)
  );
}

// --- プレビュー責務: ドック表示モード ---

/** プレビュードックの表示モード */
export type MarkdownPreviewMode = "horizontal" | "vertical";

/** 保存されていたプレビューモードを復元する（未保存時は "horizontal"） */
export function loadPreviewMode(storageKey: string): MarkdownPreviewMode {
  const saved = readSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.PREVIEW_MODE)
  );
  return saved === "vertical" ? "vertical" : "horizontal";
}

/** プレビューモードを保存する */
export function savePreviewMode(
  storageKey: string,
  mode: MarkdownPreviewMode
): void {
  writeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.PREVIEW_MODE),
    mode
  );
}

// --- 一括クリア ---

/**
 * storageKey に紐づくエディタ設定（サイドバー・プレビュー・Monaco）を
 * 一括削除する。本文ドラフト自体は useMarkdownDraft の clearDraft が担う。
 */
export function clearEditorSettings(storageKey: string): void {
  removeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.SIDEBAR_WIDTH)
  );
  removeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.SIDEBAR_MODE)
  );
  removeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.SIDEBAR_OPEN)
  );
  removeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.PREVIEW_MODE)
  );
  removeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.MONACO_FONT_SIZE)
  );
  removeSetting(
    editorStorageKey(storageKey, EDITOR_STORAGE_SUFFIXES.MONACO_WORD_WRAP)
  );
}
