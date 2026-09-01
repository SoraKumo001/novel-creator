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

  if (res.status === 502) {
    return new Error(
      `APIサーバーに接続できませんでした (502 Bad Gateway)。バックエンドサーバー（pnpm dev）が起動しているか確認してください。${detail ? ` [詳細: ${detail}]` : ""}`
    );
  }

  if (res.status === 504) {
    return new Error(
      `AIの処理がタイムアウトしました (504 Gateway Timeout)。指示内容を簡潔にして再試行してください。${detail ? ` [詳細: ${detail}]` : ""}`
    );
  }

  if (res.status === 429) {
    return new Error(
      `AIサービスのレート制限（利用制限）に達しました (429)。しばらく待ってから再試行してください。${detail ? ` [詳細: ${detail}]` : ""}`
    );
  }

  if (res.status === 401 || res.status === 403) {
    return new Error(
      `AIサービスの認証に失敗しました (${res.status})。APIキー設定をご確認ください。${detail ? ` [詳細: ${detail}]` : ""}`
    );
  }

  if (res.status >= 500) {
    return new Error(
      `サーバーエラーが発生しました (${res.status} ${res.statusText})。${detail ? ` [詳細: ${detail}]` : ""}`
    );
  }

  return new Error(
    detail ||
      `${defaultActionName}に失敗しました (${res.status} ${res.statusText})`
  );
}
