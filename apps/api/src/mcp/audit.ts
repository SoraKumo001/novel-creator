import type { Context } from "hono";

import type { AppContext } from "../context.js";
import { appLogger } from "../middleware/logger.js";

/**
 * MCP 監査ログヘルパー。
 * 秘密情報（平文キー・トークン・PII・ツール引数）は一切出さない。
 * 出してよいのは prefix 先頭8文字・keyId・tool名・novelId・duration・status のみ。
 */

/** ログに出してよいキープレフィックスの文字数（DB の prefix カラムと同幅）。 */
export const MCP_LOG_PREFIX_LENGTH = 8;

export type McpAuthFailureReason =
  | "expired"
  | "invalid"
  | "missing"
  | "revoked";

export type McpToolStatus = "error" | "ok";

/** appLogger の構造的部分型。テストで差し替え可能にする。 */
export interface McpAuditLogger {
  error(message: string, ...details: unknown[]): void;
  info(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
}

/**
 * 平文トークンを出さず先頭8文字のみ返す。
 * トークンがない場合は null を返す。
 */
export function redactKeyPrefix(
  token: string | null | undefined
): string | null {
  if (!token) {
    return null;
  }
  return token.slice(0, MCP_LOG_PREFIX_LENGTH);
}

export interface McpAuthFailureOptions {
  keyPrefix?: string | null;
  logger?: McpAuditLogger;
}

/**
 * MCP 認証失敗を warn で記録する。平文キーは出さない。
 */
export function logMcpAuthFailure(
  c: Context<AppContext>,
  reason: McpAuthFailureReason,
  options: McpAuthFailureOptions = {}
): void {
  const logger: McpAuditLogger = options.logger ?? appLogger;
  logger.warn("[MCP] auth failure", {
    keyPrefix: options.keyPrefix ?? null,
    method: c.req.method,
    path: c.req.path,
    reason,
  });
}

export interface McpToolEvent {
  durationMs: number;
  keyId?: string | null;
  novelId?: string | null;
  status: McpToolStatus;
  tool: string;
}

/**
 * MCP ツール実行イベントを記録する。ツール引数は出さない。
 * 成功は info、失敗は error で出す。
 */
export function logMcpToolEvent(
  event: McpToolEvent,
  logger: McpAuditLogger = appLogger
): void {
  const detail = {
    durationMs: event.durationMs,
    keyId: event.keyId ?? null,
    novelId: event.novelId ?? null,
    status: event.status,
    tool: event.tool,
  };
  if (event.status === "ok") {
    logger.info("[MCP] tool", detail);
  } else {
    logger.error("[MCP] tool", detail);
  }
}

export interface McpRequestResult {
  durationMs: number;
  ok: boolean;
}

/**
 * POST /api/mcp の処理結果を記録する。method・duration を出す。
 * 成功は info、失敗は error で出す。
 */
export function logMcpRequest(
  c: Context<AppContext>,
  result: McpRequestResult,
  logger: McpAuditLogger = appLogger
): void {
  const detail = {
    durationMs: result.durationMs,
    keyId: c.get("mcpAuth")?.keyId ?? null,
    method: c.req.method,
    path: c.req.path,
    status: result.ok ? "ok" : "error",
  };
  if (result.ok) {
    logger.info("[MCP] request", detail);
  } else {
    logger.error("[MCP] request", detail);
  }
}
