import type { Context, Next } from "hono";

import type { AppContext } from "../context.js";

/**
 * アプリケーション共通ロガー（Phase 1 の正とする契約）。
 * 本番パスでの直接のコンソール呼び出しは禁止し、本モジュール経由に統一する。
 * シングルシンク原則: 実行環境のコンソール (globalThis.console) に触れてよいのは
 * このファイルの sink 定義のみ。他ファイルでの console 直接呼び出しは
 * biome.jsonc の suspicious/noConsole で禁止し、本ファイル等のみ override 許可する。
 */
type LogDetail = unknown;

type LogLevel = "debug" | "error" | "info" | "silent" | "warn";

type EmitLevel = Exclude<LogLevel, "silent">;

interface AppLogger {
  child(bindings: Record<string, unknown>): AppLogger;
  debug(message: string, ...details: LogDetail[]): void;
  error(message: string, ...details: LogDetail[]): void;
  info(message: string, ...details: LogDetail[]): void;
  warn(message: string, ...details: LogDetail[]): void;
  /** Hono の Context から requestId を拾って子ロガーを返す。 */
  withContext(c: Context): AppLogger;
  /**
   * requestId を付与した子ロガーを返す。JSON 出力時は reqId フィールド、
   * 開発出力時は `[api:reqId]` プレフィックスとして付く。
   */
  withRequestId(reqId: string): AppLogger;
}

type ConsoleSink = Pick<Console, "debug" | "error" | "log" | "warn">;

/**
 * 意図的なログ出力のための単一のシンク。
 * Node.js / Workers のいずれでも利用できる実行環境のコンソールを参照する。
 * このファイル以外から console に触れてはならない。
 */
const sink: ConsoleSink = globalThis.console;

const LEVEL_ORDER: Record<EmitLevel, number> = {
  debug: 0,
  error: 3,
  info: 1,
  warn: 2,
};

/** Node.js / Workers のどちらでも落ちないように環境変数を読む。 */
function readEnv(key: string): string | undefined {
  const holder = globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  };
  return holder.process?.env?.[key];
}

function getThreshold(): LogLevel {
  const raw = readEnv("LOG_LEVEL");
  if (
    raw === "debug" ||
    raw === "error" ||
    raw === "info" ||
    raw === "silent" ||
    raw === "warn"
  ) {
    return raw;
  }
  return readEnv("NODE_ENV") === "production" ? "info" : "debug";
}

function isProduction(): boolean {
  return readEnv("NODE_ENV") === "production";
}

function writeConsole(level: EmitLevel, ...args: LogDetail[]): void {
  if (level === "debug") {
    sink.debug(...args);
  } else if (level === "error") {
    sink.error(...args);
  } else if (level === "warn") {
    sink.warn(...args);
  } else {
    sink.log(...args);
  }
}

function emit(
  level: EmitLevel,
  message: string,
  details: LogDetail[],
  reqId?: string
): void {
  const threshold = getThreshold();
  if (threshold === "silent") {
    return;
  }
  if (LEVEL_ORDER[level] < LEVEL_ORDER[threshold]) {
    return;
  }
  if (isProduction()) {
    const payload: Record<string, unknown> = {
      level,
      msg: message,
      ns: "api",
      time: new Date().toISOString(),
    };
    if (reqId !== undefined) {
      payload.reqId = reqId;
    }
    if (details.length === 1) {
      payload.data = details[0];
    } else if (details.length > 1) {
      payload.data = details;
    }
    writeConsole(level, JSON.stringify(payload));
    return;
  }
  const clock = new Date().toISOString().slice(11, 19);
  const prefix = reqId === undefined ? "[api]" : `[api:${reqId}]`;
  const line = `${prefix} ${clock} ${level.toUpperCase()} ${message}`;
  if (details.length === 0) {
    writeConsole(level, line);
  } else {
    writeConsole(level, line, ...details);
  }
}

function extractRequestId(c: Context): string | undefined {
  try {
    const fromHeader = c.req.header("x-request-id");
    if (typeof fromHeader === "string" && fromHeader.length > 0) {
      return fromHeader;
    }
  } catch {
    // ログのためだけにリクエストを落とさない。
  }
  try {
    const holder = c as unknown as { get?: (key: string) => unknown };
    const fromVar = holder.get?.call(c, "requestId");
    if (typeof fromVar === "string" && fromVar.length > 0) {
      return fromVar;
    }
  } catch {
    // ログのためだけにリクエストを落とさない。
  }
  return undefined;
}

function createLogger(reqId?: string): AppLogger {
  return {
    child(bindings: Record<string, unknown>): AppLogger {
      const candidate = bindings.reqId ?? bindings.requestId;
      if (typeof candidate === "string" && candidate.length > 0) {
        return createLogger(candidate);
      }
      return createLogger(reqId);
    },
    debug(message: string, ...details: LogDetail[]): void {
      emit("debug", message, details, reqId);
    },
    error(message: string, ...details: LogDetail[]): void {
      emit("error", message, details, reqId);
    },
    info(message: string, ...details: LogDetail[]): void {
      emit("info", message, details, reqId);
    },
    warn(message: string, ...details: LogDetail[]): void {
      emit("warn", message, details, reqId);
    },
    withContext(c: Context): AppLogger {
      return createLogger(extractRequestId(c) ?? reqId);
    },
    withRequestId(nextReqId: string): AppLogger {
      return createLogger(nextReqId);
    },
  };
}

export const appLogger: AppLogger = createLogger();

/**
 * リクエストログミドルウェア。
 * ヘルスチェック (/health を含むパス) は記録しない。
 * メソッド、パス、ステータス、所要時間を debug で記録し、
 * ステータス 500 以上のみ warn に上げる。
 */
export async function logger(
  c: Context<AppContext>,
  next: Next
): Promise<void> {
  const path = c.req.path;
  if (path.includes("/health")) {
    await next();
    return;
  }
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const status = c.res.status;
  const message = `${c.req.method} ${path} -> ${status} (${duration}ms)`;
  const scoped = appLogger.withContext(c);
  if (status >= 500) {
    scoped.warn(message);
  } else {
    scoped.debug(message);
  }
}
