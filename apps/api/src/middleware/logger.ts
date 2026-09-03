import type { Context, Next } from "hono";

import type { AppContext } from "../context.js";

/**
 * アプリケーション共通ロガー（Phase 1 の正とする契約）。
 * 本番パスでの直接 console.* 呼び出しは禁止し、本モジュール経由に統一する。
 * console を直接触ってよいのはこのファイルのみ。
 */
type LogDetail = unknown;

interface AppLogger {
  debug(message: string, ...details: LogDetail[]): void;
  error(message: string, ...details: LogDetail[]): void;
  info(message: string, ...details: LogDetail[]): void;
  warn(message: string, ...details: LogDetail[]): void;
}

export const appLogger: AppLogger = {
  debug(message: string, ...details: LogDetail[]): void {
    console.debug(`[api] ${message}`, ...details);
  },
  error(message: string, ...details: LogDetail[]): void {
    console.error(`[api] ${message}`, ...details);
  },
  info(message: string, ...details: LogDetail[]): void {
    console.log(`[api] ${message}`, ...details);
  },
  warn(message: string, ...details: LogDetail[]): void {
    console.warn(`[api] ${message}`, ...details);
  },
};

/**
 * リクエストログミドルウェア。
 * メソッド、パス、ステータス、所要時間を記録する。
 */
export async function logger(
  c: Context<AppContext>,
  next: Next
): Promise<void> {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const status = c.res.status;
  appLogger.info(`${c.req.method} ${c.req.path} -> ${status} (${duration}ms)`);
}
