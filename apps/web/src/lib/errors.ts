/**
 * API エラーレスポンスの形式。
 * バックエンドの error-handler が返す形式と一致させる。
 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * 未知のエラーから表示用メッセージを抽出する。
 * API エラーレスポンス（{ error: { code, message } }）をパースし、
 * それ以外は Error の message を返す。
 */
export function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    // fetch のエラーはレスポンスボディが message に入ることがある。
    // JSON 形式の API エラーをパースする。
    const parsed = tryParseApiError(e.message);
    if (parsed) {
      return parsed;
    }
    return e.message;
  }
  return "予期しないエラーが発生しました";
}

/**
 * 文字列が API エラーレスポンスの JSON 形式かどうかを判定し、メッセージを返す。
 */
function tryParseApiError(text: string): string | null {
  if (!text) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as ApiErrorBody;
    if (parsed && typeof parsed === "object" && parsed.error) {
      return parsed.error.message || "リクエストに失敗しました";
    }
  } catch {
    // JSON でない場合は無視
  }
  return null;
}

/**
 * 404（未作成リソース）系のエラーかどうかを判定する。
 * 本文が未作成のセクションでは contents 行が存在せず API が 404 を返すため、
 * フロントでは空本文として扱いリトライしない。
 */
export function isNotFoundError(e: unknown): boolean {
  if (!e) {
    return false;
  }
  const message = e instanceof Error ? (e.message ?? "") : String(e);
  if (message.includes("(404") || message.includes(" 404")) {
    return true;
  }
  return (
    message.includes("Content not found") ||
    message.includes("コンテンツが見つかりません")
  );
}

/**
 * 既知の英語エラーメッセージを日本語に変換するマップ。
 */
const KNOWN_ERROR_TRANSLATIONS: Record<string, string> = {
  "invalid email or password":
    "メールアドレスまたはパスワードが正しくありません",
  "user already exists": "このメールアドレスは既に登録されています",
  "sign-up is disabled": "新規ユーザー登録は無効化されています",
  "password is too short": "パスワードが短すぎます",
  "invalid password": "パスワードが正しくありません",
  "user not found": "ユーザーが見つかりません",
  "session expired":
    "セッションの有効期限が切れました。再度ログインしてください",
};

/**
 * エラーメッセージ内の英語表記をユーザー向けの日本語に変換する。
 */
export function translateErrorMessage(message: string): string {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  for (const [key, val] of Object.entries(KNOWN_ERROR_TRANSLATIONS)) {
    if (lower === key || lower.includes(key)) {
      return val;
    }
  }
  return trimmed;
}

/**
 * Fetch Response オブジェクトから適切な日本語エラーメッセージを抽出・構築する。
 */
export async function parseResponseError(
  res: Response,
  defaultActionName: string = "処理"
): Promise<Error> {
  let detail = "";
  try {
    const json = (await res.json()) as Record<string, unknown>;
    if (json && typeof json === "object") {
      const errObj = (json.error as Record<string, unknown>) ?? json;
      if (typeof errObj.message === "string" && errObj.message.trim()) {
        detail = errObj.message.trim();
      }
    }
  } catch {
    try {
      detail = (await res.text()).trim();
    } catch {
      // ignore
    }
  }

  const translatedDetail = detail ? translateErrorMessage(detail) : "";
  const isAiAction =
    defaultActionName.includes("AI") ||
    Boolean(
      res.url &&
        (res.url.includes("/api/ai") ||
          res.url.includes("/api/chat") ||
          res.url.includes("/api/generate"))
    );
  const isAuthAction =
    defaultActionName === "ログイン" ||
    defaultActionName.includes("認証") ||
    defaultActionName.includes("登録") ||
    Boolean(res.url && res.url.includes("/auth/"));

  if (res.status === 502) {
    return new Error(
      `APIサーバーに接続できませんでした (502 Bad Gateway)。バックエンドサーバー（pnpm dev）が起動しているか確認してください。${translatedDetail ? ` [詳細: ${translatedDetail}]` : ""}`
    );
  }

  if (res.status === 504) {
    const prefix = isAiAction ? "AIの処理" : "処理";
    return new Error(
      `${prefix}がタイムアウトしました (504 Gateway Timeout)。${isAiAction ? "指示内容を簡潔にして再試行してください。" : "しばらく待ってから再試行してください。"}${translatedDetail ? ` [詳細: ${translatedDetail}]` : ""}`
    );
  }

  if (res.status === 429) {
    const prefix = isAiAction
      ? "AIサービスのレート制限（利用制限）に達しました"
      : "アクセスが集中しています";
    return new Error(
      `${prefix} (429)。しばらく待ってから再試行してください。${translatedDetail ? ` [詳細: ${translatedDetail}]` : ""}`
    );
  }

  if (res.status === 401) {
    if (isAuthAction) {
      return new Error(
        translatedDetail || "メールアドレスまたはパスワードが正しくありません"
      );
    }
    if (isAiAction) {
      return new Error(
        `AIサービスの認証に失敗しました (401)。APIキー設定をご確認ください。${translatedDetail ? ` [詳細: ${translatedDetail}]` : ""}`
      );
    }
    return new Error(
      translatedDetail || "認証に失敗しました。ログインしてください。"
    );
  }

  if (res.status === 403) {
    if (isAiAction) {
      return new Error(
        `AIサービスの権限がありません (403)。${translatedDetail ? ` [詳細: ${translatedDetail}]` : ""}`
      );
    }
    return new Error(
      translatedDetail || `アクセス権限がありません (${res.status})。`
    );
  }

  if (res.status >= 500) {
    return new Error(
      `サーバーエラーが発生しました (${res.status} ${res.statusText})。${translatedDetail ? ` [詳細: ${translatedDetail}]` : ""}`
    );
  }

  return new Error(
    translatedDetail ||
      `${defaultActionName}に失敗しました (${res.status} ${res.statusText})`
  );
}
