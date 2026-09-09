/**
 * MCP レート制限（Workers対応インメモリ token-bucket）。
 * Node.js / Cloudflare Workers の双方で動作するよう
 * Web 標準（Date.now / Map / setTimeout）のみに依存する。
 * per-key（keyId）と per-IP の多層バケットで評価する。
 */

export interface RateLimitBucketConfig {
  /** バケット容量（バースト許容量）。 */
  burst: number;
  /** 1分あたりの補充トークン数。 */
  refillPerMinute: number;
}

/** 既定バケット: 60 req/min、バースト 10。 */
export const DEFAULT_MCP_RATE_LIMIT: RateLimitBucketConfig = {
  burst: 10,
  refillPerMinute: 60,
};

/** 高コスト系バケット: 10 req/min、バースト 2。 */
export const EXPENSIVE_MCP_RATE_LIMIT: RateLimitBucketConfig = {
  burst: 2,
  refillPerMinute: 10,
};

/** 高コスト系ツール名（別バケットで評価する）。 */
export const EXPENSIVE_MCP_TOOLS: readonly string[] = [
  "batch_create_foreshadowings",
  "batch_create_timeline_events",
  "batch_get_section_contents",
  "batch_save_section_contents",
  "batch_update_foreshadowings",
  "batch_update_timeline_events",
  "search_novel_knowledge",
];

/** MCP リクエストのタイムアウト（30秒）。 */
export const MCP_REQUEST_TIMEOUT_MS = 30_000;

export function isExpensiveMcpTool(tool: string | null | undefined): boolean {
  if (!tool) {
    return false;
  }
  return EXPENSIVE_MCP_TOOLS.includes(tool);
}

export interface RateLimitBucketState {
  tokens: number;
  updatedAt: number;
}

export type RateLimitStore = Map<string, RateLimitBucketState>;

const defaultStore: RateLimitStore = new Map();

export interface CheckRateLimitOptions {
  bucket?: RateLimitBucketConfig;
  /** 注入可能な現在時刻（ミリ秒）。省略時は Date.now()。 */
  now?: number;
  /** 注入可能なストア。省略時はモジュール既定の Map。 */
  store?: RateLimitStore;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

/**
 * token-bucket を評価する純関数（副作用は store のみ）。
 */
export function checkRateLimit(
  key: string,
  options: CheckRateLimitOptions = {}
): RateLimitResult {
  const bucket = options.bucket ?? DEFAULT_MCP_RATE_LIMIT;
  const now = options.now ?? Date.now();
  const store = options.store ?? defaultStore;
  const capacity = Math.max(1, Math.floor(bucket.burst));
  const refillPerMs = Math.max(0, bucket.refillPerMinute) / 60_000;

  const prev = store.get(key);
  const elapsed = prev ? Math.max(0, now - prev.updatedAt) : 0;
  const tokens = prev
    ? Math.min(capacity, prev.tokens + elapsed * refillPerMs)
    : capacity;

  if (tokens >= 1) {
    store.set(key, { tokens: tokens - 1, updatedAt: now });
    return { allowed: true };
  }
  const retryAfterSec =
    refillPerMs > 0
      ? Math.max(1, Math.ceil((1 - tokens) / refillPerMs / 1000))
      : 60;
  store.set(key, { tokens, updatedAt: now });
  return { allowed: false, retryAfterSec };
}

/** 既定ストアを空にする（主にテスト用）。 */
export function resetRateLimitStore(
  store: RateLimitStore = defaultStore
): void {
  store.clear();
}

export interface McpRateLimitKeys {
  expensive: string;
  ip: string;
  key: string;
}

export function getMcpRateLimitKeys(
  keyId: string,
  ip: string
): McpRateLimitKeys {
  return {
    expensive: `mcp:ratelimit:expensive:${keyId}`,
    ip: `mcp:ratelimit:ip:${ip}`,
    key: `mcp:ratelimit:key:${keyId}`,
  };
}

export interface CheckMcpRateLimitInput {
  ip?: string | null;
  keyId: string;
  now?: number;
  store?: RateLimitStore;
  tool?: string | null;
}

/**
 * per-key → per-IP →（高コスト系のみ）expensive の順に多層評価する。
 * いずれかで拒否されたら即座に拒否を返す。
 */
export function checkMcpRateLimit(
  input: CheckMcpRateLimitInput
): RateLimitResult {
  const keys = getMcpRateLimitKeys(input.keyId, input.ip ?? "unknown");
  const base: CheckRateLimitOptions = {
    now: input.now,
    store: input.store,
  };
  const keyResult = checkRateLimit(keys.key, base);
  if (!keyResult.allowed) {
    return keyResult;
  }
  const ipResult = checkRateLimit(keys.ip, base);
  if (!ipResult.allowed) {
    return ipResult;
  }
  if (isExpensiveMcpTool(input.tool)) {
    const expensiveResult = checkRateLimit(keys.expensive, {
      ...base,
      bucket: EXPENSIVE_MCP_RATE_LIMIT,
    });
    if (!expensiveResult.allowed) {
      return expensiveResult;
    }
  }
  return { allowed: true };
}

/**
 * JSON-RPC ボディから tools/call のツール名を取り出す。
 * 取り出せない場合は null を返す。
 */
export function extractMcpToolName(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (record["method"] !== "tools/call") {
    return null;
  }
  const params = record["params"];
  if (typeof params !== "object" || params === null) {
    return null;
  }
  const name = (params as Record<string, unknown>)["name"];
  return typeof name === "string" ? name : null;
}

export class McpRequestTimeoutError extends Error {
  constructor(timeoutMs: number = MCP_REQUEST_TIMEOUT_MS) {
    super(`MCP request timed out after ${timeoutMs}ms`);
    this.name = "McpRequestTimeoutError";
  }
}

export class McpRequestAbortedError extends Error {
  constructor() {
    super("MCP request aborted by client");
    this.name = "McpRequestAbortedError";
  }
}

/**
 * クライアント切断時に決して解決しない promise を返す代わりに
 * 中断時だけ reject するガード promise を返す。
 */
export function rejectOnAbort(
  signal: AbortSignal | null | undefined
): Promise<never> {
  if (!signal) {
    return new Promise<never>(() => undefined);
  }
  if (signal.aborted) {
    return Promise.reject(new McpRequestAbortedError());
  }
  return new Promise<never>((_resolve, reject) => {
    signal.addEventListener(
      "abort",
      () => {
        reject(new McpRequestAbortedError());
      },
      { once: true }
    );
  });
}

/**
 * タスクにタイムアウトを付与する。超過時は McpRequestTimeoutError で reject する。
 */
export function withMcpTimeout<T>(
  task: Promise<T>,
  timeoutMs: number = MCP_REQUEST_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new McpRequestTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  return Promise.race([task, timeout]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}
