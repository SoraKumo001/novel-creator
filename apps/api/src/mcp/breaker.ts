/**
 * MCP サーキットブレーカー＋同時実行制限（Workers対応インメモリ）。
 * Web 標準（Date.now / Map）のみに依存し、副作用はモジュール内状態のみ。
 * 時刻・ストアは注入可能にし、テスト容易性を保つ。
 */

/** 連続失敗で open するしきい値。 */
export const BREAKER_FAILURE_THRESHOLD = 5;

/** open 継続時間（ミリ秒）。 */
export const BREAKER_OPEN_MS = 30_000;

/** プロセス内同時実行上限。 */
export const MCP_MAX_CONCURRENT = 20;

export interface BreakerState {
  consecutiveFailures: number;
  halfOpenTrial: boolean;
  openedAt: number | null;
}

export type BreakerStore = Map<string, BreakerState>;

const defaultBreakerStore: BreakerStore = new Map();

export interface BreakerOptions {
  /** 注入可能な現在時刻（ミリ秒）。省略時は Date.now()。 */
  now?: number;
  /** open 継続時間の上書き。 */
  openMs?: number;
  /** 注入可能なストア。省略時はモジュール既定の Map。 */
  store?: BreakerStore;
  /** しきい値の上書き。 */
  threshold?: number;
}

export interface BreakerCheck {
  open: boolean;
  retryAfterSec?: number;
}

/** ブレーカーキー（keyId 単位）を組み立てる。 */
export function mcpBreakerKey(keyId: string | null | undefined): string {
  return `mcp:breaker:${keyId ?? "anonymous"}`;
}

function freshState(): BreakerState {
  return { consecutiveFailures: 0, halfOpenTrial: false, openedAt: null };
}

/**
 * ブレーカー状態を評価する。open 中は true を返す。
 * open 期間終了後は half-open として1件のみ試行を許可し、
 * 試行中は再び open 扱いにする。
 */
export function checkBreaker(
  key: string,
  options: BreakerOptions = {}
): BreakerCheck {
  const now = options.now ?? Date.now();
  const store = options.store ?? defaultBreakerStore;
  const openMs = options.openMs ?? BREAKER_OPEN_MS;
  const state = store.get(key);
  if (!state || state.openedAt === null) {
    return { open: false };
  }
  const elapsed = now - state.openedAt;
  if (elapsed < openMs) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((openMs - Math.max(0, elapsed)) / 1000)
    );
    return { open: true, retryAfterSec };
  }
  if (state.halfOpenTrial) {
    return { open: true, retryAfterSec: 1 };
  }
  store.set(key, { ...state, halfOpenTrial: true });
  return { open: false };
}

/** 成功を記録し、ブレーカーを閉じる。 */
export function recordSuccess(key: string, options: BreakerOptions = {}): void {
  const store = options.store ?? defaultBreakerStore;
  store.set(key, freshState());
}

/** 失敗を記録する。しきい値到達または half-open 試行失敗で open する。 */
export function recordFailure(key: string, options: BreakerOptions = {}): void {
  const now = options.now ?? Date.now();
  const store = options.store ?? defaultBreakerStore;
  const threshold = options.threshold ?? BREAKER_FAILURE_THRESHOLD;
  const prev = store.get(key) ?? freshState();
  const consecutiveFailures = prev.consecutiveFailures + 1;
  if (prev.halfOpenTrial || consecutiveFailures >= threshold) {
    store.set(key, {
      consecutiveFailures,
      halfOpenTrial: false,
      openedAt: now,
    });
    return;
  }
  store.set(key, { ...prev, consecutiveFailures });
}

/** ブレーカー状態を初期化する（主にテスト用）。 */
export function resetBreaker(
  key: string,
  store: BreakerStore = defaultBreakerStore
): void {
  store.delete(key);
}

let activeSlots = 0;

/** 現在の同時実行数。 */
export function getMcpActiveSlots(): number {
  return activeSlots;
}

/** スロットを取得する。取得できたら true。 */
export function tryAcquireMcpSlot(limit: number = MCP_MAX_CONCURRENT): boolean {
  if (activeSlots >= limit) {
    return false;
  }
  activeSlots += 1;
  return true;
}

/** スロットを返却する。 */
export function releaseMcpSlot(): void {
  activeSlots = Math.max(0, activeSlots - 1);
}

/** スロット数を初期化する（主にテスト用）。 */
export function resetMcpSlots(): void {
  activeSlots = 0;
}
