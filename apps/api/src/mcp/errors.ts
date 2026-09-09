/**
 * MCP / JSON-RPC エラー対応表。
 * ツール実行結果の isError（ドメインエラーの通知）とは層が異なり、
 * こちらはプロトコル・トランスポート層のエラーコードを扱う。
 * isError と混同しないこと（分離の意図はこのコメントの通り）。
 */

export const JSON_RPC_ERROR_MESSAGES = {
  "-32600": "Invalid Request",
  "-32601": "Method not found",
  "-32602": "Invalid params",
  "-32603": "Internal error",
  "-32700": "Parse error",
  "-32020": "HeaderMismatch",
  "-32021": "MissingCapability",
} as const;

export type JsonRpcErrorCode = keyof typeof JSON_RPC_ERROR_MESSAGES;

export interface JsonRpcError {
  code: number;
  data?: unknown;
  message: string;
}

/**
 * エラーコードを JSON-RPC エラーオブジェクトに変換する。
 * 未知のコードは "Unknown error" とする。
 */
export function toJsonRpcError(code: number, data?: unknown): JsonRpcError {
  const message =
    String(code) in JSON_RPC_ERROR_MESSAGES
      ? JSON_RPC_ERROR_MESSAGES[String(code) as JsonRpcErrorCode]
      : "Unknown error";
  return data === undefined ? { code, message } : { code, data, message };
}

const RETRYABLE_STRING_CODES: readonly string[] = ["timeout", "transport"];

/**
 * 再試行可能かを判定する。
 * transport層の失敗・-32603・503・timeout のみ true を返す。
 */
export function isRetryable(code: number | string): boolean {
  if (typeof code === "string") {
    return RETRYABLE_STRING_CODES.includes(code);
  }
  return code === -32_603 || code === 503;
}
