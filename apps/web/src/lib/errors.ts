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
    if (parsed) return parsed;
    return e.message;
  }
  return '予期しないエラーが発生しました';
}

/**
 * 文字列が API エラーレスポンスの JSON 形式かどうかを判定し、メッセージを返す。
 */
function tryParseApiError(text: string): string | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as ApiErrorBody;
    if (parsed && typeof parsed === 'object' && parsed.error) {
      return parsed.error.message || 'リクエストに失敗しました';
    }
  } catch {
    // JSON でない場合は無視
  }
  return null;
}
