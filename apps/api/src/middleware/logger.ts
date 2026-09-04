import type { Context, Next } from "hono";

import type { AppContext } from "../context.js";

/**
 * アプリケーション共通ロガー（Phase 1 の正とする契約）。
 * 本番パスでの直接のコンソール呼び出しは禁止し、本モジュール経由に統一する。
 * 実行環境のコンソールに触れてよいのはこのファイルのみ。
 */
type LogDetail = unknown;

interface AppLogger {
  debug(message: string, ...details: LogDetail[]): void;
  error(message: string, ...details: LogDetail[]): void;
  info(message: string, ...details: LogDetail[]): void;
  warn(message: string, ...details: LogDetail[]): void;
}

type ConsoleSink = Pick<Console, "debug" | "error" | "log" | "warn">;

/**
 * 意図的なログ出力のための単一のシンク。
 * Node.js / Workers のいずれでも利用できる実行環境のコンソールを参照する。
 */
const sink: ConsoleSink = globalThis.console;

export const appLogger: AppLogger = {
  debug(message: string, ...details: LogDetail[]): void {
    sink.debug(`[api] ${message}`, ...details);
  },
  error(message: string, ...details: LogDetail[]): void {
    sink.error(`[api] ${message}`, ...details);
  },
  info(message: string, ...details: LogDetail[]): void {
    sink.log(`[api] ${message}`, ...details);
  },
  warn(message: string, ...details: LogDetail[]): void {
    sink.warn(`[api] ${message}`, ...details);
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
