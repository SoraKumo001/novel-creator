import type { McpAuth } from "../core/types.js";

/**
 * MCP ポリシー（ツール許可・破壊操作の確認要求・Origin 検証）。
 * Workers対応のため Web 標準のみに依存し、副作用を持たない純関数のみ置く。
 */

/** 確認なしでは実行できない破壊的ツール。 */
export const DESTRUCTIVE_TOOLS: readonly string[] = [
  "delete_novel",
  "delete_chapter",
  "delete_section",
  "delete_character",
  "delete_setting",
  "delete_foreshadowing",
  "delete_timeline_event",
];

export interface McpPolicyOptions {
  /**
   * 許可ツール一覧（将来拡張用）。null/undefined の場合は全ツールを許可する。
   */
  allowedTools?: readonly string[] | null;
}

/**
 * ツール実行がポリシー上許可されるかを判定する。
 * 全体キー・認証なし内部利用は基本許可し、スコープ内判定は scope-guard 側で行う。
 */
export function isToolAllowed(
  auth: McpAuth | undefined,
  toolName: string,
  options: McpPolicyOptions = {}
): boolean {
  if (
    options.allowedTools !== null &&
    options.allowedTools !== undefined &&
    !options.allowedTools.includes(toolName)
  ) {
    return false;
  }
  if (!auth || auth.novelId === null) {
    return true;
  }
  return true;
}

/** 破壊的ツールで確認が必要かを判定する。 */
export function requiresConfirmation(toolName: string): boolean {
  return (DESTRUCTIVE_TOOLS as readonly string[]).includes(toolName);
}

/**
 * tools/call ボディに arguments.confirm === true が含まれるかを判定する。
 */
export function hasConfirmation(body: unknown): boolean {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const params = (body as Record<string, unknown>)["params"];
  if (typeof params !== "object" || params === null) {
    return false;
  }
  const args = (params as Record<string, unknown>)["arguments"];
  if (typeof args !== "object" || args === null) {
    return false;
  }
  return (args as Record<string, unknown>)["confirm"] === true;
}

function normalizeOrigin(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, "");
}

/**
 * Origin 検証。Origin ヘッダがある場合のみ WEB_ORIGIN と照合する。
 * ヘッダなし（非ブラウザクライアント）・比較対象なしは許可する。
 */
export function isOriginAllowed(
  origin: string | null | undefined,
  webOrigin: string | null | undefined
): boolean {
  if (!origin || !webOrigin) {
    return true;
  }
  return normalizeOrigin(origin) === normalizeOrigin(webOrigin);
}
